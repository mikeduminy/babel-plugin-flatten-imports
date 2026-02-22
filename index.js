/**
 * babel-plugin-flatten-imports.js
 *
 * Rewrites import statements to bypass re-export chains (barrel files, etc.)
 * and point directly at the file that declares the symbol.
 *
 * Example:
 *   import { foo } from './barrels/index'
 *   // ...where index.js does: export { foo } from '../foo/index'
 *   // ...where that does:     export { foo } from '../foo/foo'
 *   // ...where that does:     export function foo() {}
 *
 * Becomes:
 *   import { foo } from '../../foo/foo'
 *
 * Options:
 *   - platforms: Array of platform suffixes (e.g., ['native', 'android', 'ios'])
 *     Creates extensions like .native.js, .android.js before .js
 *   - extensions: Custom extensions array (default: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])
 *
 * Dependencies:
 *   npm install oxc-resolver @babel/helper-module-imports
 */

const path = require("path");
const fs = require("fs");
const { ResolverFactory } = require("oxc-resolver");
// We use Babel's own parser for intermediate files since we're already in
// a Babel context. Could swap for oxc-parser bindings for extra speed.
const parser = require("@babel/parser");
const declare = require("@babel/helper-plugin-utils").declare;

// ---------------------------------------------------------------------------
// Resolver setup
// ---------------------------------------------------------------------------

/**
 * Build extensions list with platform-specific suffixes
 * @param {Array<string>} platforms - Platform suffixes like ['native', 'android', 'ios']
 * @param {Array<string>} baseExtensions - Base extensions like ['.js', '.jsx', '.ts', '.tsx']
 * @returns {Array<string>} Combined extensions with platform variants first
 */
function buildExtensions(
  platforms = [],
  baseExtensions = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
) {
  if (!platforms || platforms.length === 0) {
    return baseExtensions;
  }

  const platformExtensions = [];

  // For each base extension, create platform-specific variants
  for (const ext of baseExtensions) {
    for (const platform of platforms) {
      platformExtensions.push(`.${platform}${ext}`);
    }
  }

  // Platform-specific extensions should be tried first, then base extensions
  return [...platformExtensions, ...baseExtensions];
}

/**
 * Create a resolver with the given options
 * @param {Object} options - Plugin options
 * @returns {ResolverFactory} Configured resolver
 */
function createResolver(options = {}) {
  const extensions = buildExtensions(options.platforms, options.extensions);

  // TODO: consider spreading options to allow custom resolver config
  // (alias, tsconfig, etc.)
  return new ResolverFactory({
    conditionNames: options.conditionNames || ["import", "module", "default"],
    extensions,
    // If you use tsconfig paths or webpack aliases, add them via options:
    // alias: options.alias,
    // tsconfig: options.tsconfig,
  });
}

// ---------------------------------------------------------------------------
// Export map cache
// ---------------------------------------------------------------------------

// Maps absolute file path -> Map<exportedName, { file, exportedName }>
// where the inner value is already fully resolved (i.e. the canonical source).
//
// We store the *raw* export info first and resolve lazily/recursively.
// Shape of raw entry: Map<exportedName, { kind, file?, localName? }>
//   kind: 'declaration'  — symbol is declared in this file
//   kind: 'reexport'     — re-exported from another file (file + localName)
//   kind: 'wildcard'     — re-exported via `export * from` (file, name unknown until lookup)

/** @type {Map<string, Map<string, RawExport>>} */
const rawExportCache = new Map(); // absolutePath -> Map<name, RawExport>
/** @type {Map<string, { file: string, exportedName: string } | null>} */
const resolvedCache = new Map(); // `${absolutePath}::${name}` -> { file, exportedName } | null

// ---------------------------------------------------------------------------
// File parsing helpers
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RawExport
 * @property {'declaration' | 'reexport' | 'wildcard'} kind - The kind of export
 * @property {string} [fromSpecifier] - The specifier from which the symbol is re-exported (for 'reexport' and 'wildcard' kinds)
 * @property {string} [localName] - The local name of the symbol in the source file
 */

/**
 * Parse a file and extract its raw export map.
 * Returns Map<exportedName, RawExport> or null if the file can't be parsed.
 *
 * @param {string} absolutePath - The absolute path of the file to parse
 * @returns {Map<string, RawExport> | null} Map of exported names to their raw export info, or null if unparseable
 */
function parseFileExports(absolutePath) {
  if (rawExportCache.has(absolutePath)) return rawExportCache.get(absolutePath);

  let src;
  try {
    src = fs.readFileSync(absolutePath, "utf8");
  } catch {
    // File not readable (maybe a native module, etc.) — give up on this path.
    rawExportCache.set(absolutePath, null);
    return null;
  }

  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy"],
    });
  } catch {
    // Unparseable — could be a non-JS asset or syntax we don't handle.
    rawExportCache.set(absolutePath, null);
    return null;
  }

  /** @type {Map<string, RawExport>} */
  const exports = new Map(); // name -> RawExport

  for (const node of ast.program.body) {
    // export { foo, bar as baz } from './other'
    if (
      node.type === "ExportNamedDeclaration" &&
      node.source &&
      node.specifiers.length > 0
    ) {
      for (const spec of node.specifiers) {
        // spec.exported.name is what this file exposes
        // spec.local.name is the name as exported from the source file
        exports.set(spec.exported.name, {
          kind: "reexport",
          fromSpecifier: node.source.value, // relative/package specifier
          localName: spec.local.name,
        });
      }
    }

    // export * from './other'
    // We can't enumerate names here — we'll handle this during resolution
    // by falling through to the wildcard sources.
    else if (node.type === "ExportAllDeclaration") {
      // Use a special sentinel key so we know about wildcard sources.
      // We accumulate an array because there can be multiple export* lines.
      if (!exports.has("__wildcards__")) exports.set("__wildcards__", []);
      exports.get("__wildcards__").push(node.source.value);
    }

    // export const foo = ..., export function foo() {}, export class Foo {}
    else if (
      node.type === "ExportNamedDeclaration" &&
      !node.source &&
      node.declaration
    ) {
      const decl = node.declaration;
      if (decl.id) {
        // export function foo / export class Foo / export const foo (single)
        exports.set(decl.id.name, { kind: "declaration" });
      } else if (decl.declarations) {
        // export const foo = 1, bar = 2
        for (const d of decl.declarations) {
          if (d.id.type === "Identifier") {
            exports.set(d.id.name, { kind: "declaration" });
          }
          // Destructuring patterns (export const { a, b } = ...) are trickier;
          // skip for now or add a recursive pattern walker here.
        }
      }
    }

    // export default — we represent this as the special name 'default'
    else if (node.type === "ExportDefaultDeclaration") {
      exports.set("default", { kind: "declaration" });
    }

    // export { foo } (local re-export without a source — symbol lives in this file
    // or was imported and re-exported)
    else if (
      node.type === "ExportNamedDeclaration" &&
      !node.source &&
      node.specifiers.length > 0
    ) {
      // The local binding could itself be imported. We can't follow this
      // without tracking the full scope, so we conservatively mark it as
      // a declaration in this file. Good enough for most barrel patterns.
      for (const spec of node.specifiers) {
        exports.set(spec.exported.name, { kind: "declaration" });
      }
    }
  }

  rawExportCache.set(absolutePath, exports);
  return exports;
}

// ---------------------------------------------------------------------------
// Symbol resolution
// ---------------------------------------------------------------------------

/**
 * Given a symbol name and the absolute path of the file that mentions it,
 * walk the re-export chain until we find the file that actually declares it.
 *
 * Returns { file: absolutePath, exportedName: string } or null if unresolvable.
 *
 * `visitedKey` is used to detect cycles.
 *
 * @param {string} name - The exported name to resolve (e.g., 'foo' or 'default')
 * @param {string} absoluteFilePath - The file where this symbol is referenced
 * @param {ResolverFactory} resolver - An oxc-resolver instance for resolving specifiers
 * @param {Set<string>} visited - Set of `${absoluteFilePath}::${name}` keys to detect cycles
 * @returns {{ file: string, exportedName: string } | null} The resolved source file and exported name, or null if unresolvable
 */
function resolveSymbol(name, absoluteFilePath, resolver, visited = new Set()) {
  const cacheKey = `${absoluteFilePath}::${name}`;
  if (resolvedCache.has(cacheKey)) return resolvedCache.get(cacheKey);

  // Cycle guard
  if (visited.has(cacheKey)) return null;
  visited.add(cacheKey);

  const exports = parseFileExports(absoluteFilePath);
  if (!exports) {
    resolvedCache.set(cacheKey, null);
    return null;
  }

  const entry = exports.get(name);

  if (entry) {
    if (entry.kind === "declaration") {
      // Found it — this file declares the symbol.
      const result = { file: absoluteFilePath, exportedName: name };
      resolvedCache.set(cacheKey, result);
      return result;
    }

    if (entry.kind === "reexport") {
      // Resolve the specifier to an absolute path using oxc-resolver,
      // then recurse into that file looking for entry.localName.
      const dir = path.dirname(absoluteFilePath);
      const resolved = resolver.sync(dir, entry.fromSpecifier);

      if (!resolved || resolved.error) {
        // Can't resolve — leave this import alone.
        resolvedCache.set(cacheKey, null);
        return null;
      }

      const result = resolveSymbol(
        entry.localName,
        resolved.path,
        resolver,
        visited,
      );
      resolvedCache.set(cacheKey, result);
      return result;
    }
  }

  // Not found directly — check wildcard re-exports.
  // We have to speculatively search each `export * from` source.
  const wildcards = exports.get("__wildcards__");
  if (wildcards) {
    const dir = path.dirname(absoluteFilePath);
    for (const specifier of wildcards) {
      const resolved = resolver.sync(dir, specifier);
      if (!resolved || resolved.error) continue;

      const result = resolveSymbol(name, resolved.path, resolver, visited);
      if (result) {
        resolvedCache.set(cacheKey, result);
        return result;
      }
    }
  }

  // Genuinely not found.
  resolvedCache.set(cacheKey, null);
  return null;
}

// ---------------------------------------------------------------------------
// Path relativization helper
// ---------------------------------------------------------------------------

/**
 * Given an absolute path to the resolved source file, produce a relative
 * specifier suitable for use in an import statement in `fromFile`.
 *
 * We always emit relative paths so the output doesn't depend on resolver
 * config at the consumer's end.
 *
 * Platform suffixes and file extensions are stripped from the output -
 * the bundler will handle both platform-specific resolution and extensions.
 *
 * @param {string} fromFile - The file where the import will be emitted
 * @param {string} toAbsolutePath - The absolute path of the file we're importing
 * @param {Array<string>} platforms - Optional array of platform suffixes to strip (e.g., ['native', 'android'])
 * @returns {string} A relative path from `fromFile` to `toAbsolutePath`, without platform suffixes or extensions
 */
function makeRelativeSpecifier(fromFile, toAbsolutePath, platforms = []) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toAbsolutePath);

  // path.relative gives us OS separators; normalize to forward slashes.
  rel = rel.split(path.sep).join("/");

  // Strip platform suffixes (e.g., .native.js -> .js, .android.tsx -> .tsx)
  // The bundler will resolve the platform-specific file at runtime
  if (platforms && platforms.length > 0) {
    for (const platform of platforms) {
      // Match patterns like .native.js, .android.tsx, etc.
      const pattern = new RegExp(`\\.${platform}(\\.[^.]+)$`);
      if (pattern.test(rel)) {
        rel = rel.replace(pattern, "$1");
        break;
      }
    }
  }

  // Strip file extension - bundlers handle extension resolution
  // Removes .js, .jsx, .ts, .tsx, .mjs, .cjs, etc.
  rel = rel.replace(/\.[^./]+$/, "");

  // Ensure it starts with ./ or ../
  if (!rel.startsWith(".")) rel = "./" + rel;

  return rel;
}

// ---------------------------------------------------------------------------
// Babel plugin
// ---------------------------------------------------------------------------

// Cache resolvers by options to avoid recreating for the same config
/** @type {WeakMap<Object, ResolverFactory>} */
const resolverCache = new WeakMap();

module.exports = declare(function flattenImportsPlugin({ types: t }) {
  /** @type {ResolverFactory} */
  let resolver;
  let platforms;

  return {
    name: "flatten-imports",

    pre(_state) {
      // Create or reuse a resolver based on plugin options
      const opts = this.opts || {};

      // Try to get cached resolver, or create a new one
      if (!resolverCache.has(opts)) {
        resolverCache.set(opts, createResolver(opts));
      }
      resolver = resolverCache.get(opts);
      platforms = opts.platforms || [];
    },

    visitor: {
      ImportDeclaration(nodePath, state) {
        const sourceFile = state.filename;
        if (!sourceFile) return; // shouldn't happen, but guard anyway

        const originalSpecifier = nodePath.node.source.value;

        // Resolve the import's source to an absolute path first.
        const sourceDir = path.dirname(sourceFile);
        const resolved = resolver.sync(sourceDir, originalSpecifier);

        // If we can't resolve it (e.g. a CDN URL, uninstalled package) leave it alone.
        if (!resolved || resolved.error) return;

        const resolvedSourcePath = resolved.path;

        // Collect rewritten specifiers.
        // We group by target file so we can emit one import per file,
        // which is cleaner and avoids duplicate import declarations.
        //
        /** @type {Map<string, Array<{ kind: 'default' | 'named', imported?: string, local: string }>>} */
        const groups = new Map();
        const unresolvedSpecifiers = []; // things we couldn't follow

        for (const specifier of nodePath.node.specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            // eg. default specifier: import foo from '...'
            // Treat default import as the name 'default' in our export map.
            const result = resolveSymbol(
              "default",
              resolvedSourcePath,
              resolver,
            );
            if (result && result.file !== resolvedSourcePath) {
              if (!groups.has(result.file)) groups.set(result.file, []);
              groups.get(result.file).push({
                kind: "default",
                local: specifier.local.name,
              });
            } else {
              unresolvedSpecifiers.push(specifier);
            }
          } else if (t.isImportSpecifier(specifier)) {
            // eg. import specifier: import { foo } from '...'
            const importedName =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value; // string literal case

            const result = resolveSymbol(
              importedName,
              resolvedSourcePath,
              resolver,
            );

            if (result && result.file !== resolvedSourcePath) {
              // We found a deeper source — group it.
              if (!groups.has(result.file)) groups.set(result.file, []);
              groups.get(result.file).push({
                kind: "named",
                imported: result.exportedName,
                local: specifier.local.name,
              });
            } else {
              // Either unresolvable or already at the source — leave as-is.
              unresolvedSpecifiers.push(specifier);
            }
          } else {
            // Namespace import (import * as foo) — can't flatten these,
            // we'd have to know all names up front.
            unresolvedSpecifiers.push(specifier);
          }
        }

        // If nothing changed, bail out without touching the AST.
        if (groups.size === 0) return;

        const replacements = [];

        // Re-emit the original import for any specifiers we couldn't resolve.
        if (unresolvedSpecifiers.length > 0) {
          replacements.push(
            t.importDeclaration(
              unresolvedSpecifiers,
              t.stringLiteral(originalSpecifier),
            ),
          );
        }

        // Emit a new import for each resolved target file.
        for (const [targetFile, specs] of groups) {
          const newSpecifier = makeRelativeSpecifier(
            sourceFile,
            targetFile,
            platforms,
          );

          const importSpecifiers = specs.map((s) => {
            if (s.kind === "default") {
              return t.importDefaultSpecifier(t.identifier(s.local));
            }
            // named — preserve aliasing if the local name differs
            if (s.imported === s.local) {
              return t.importSpecifier(
                t.identifier(s.local),
                t.identifier(s.imported),
              );
            }
            return t.importSpecifier(
              t.identifier(s.local),
              t.identifier(s.imported),
            );
          });

          replacements.push(
            t.importDeclaration(
              importSpecifiers,
              t.stringLiteral(newSpecifier),
            ),
          );
        }

        // Replace the single original ImportDeclaration with our array.
        nodePath.replaceWithMultiple(replacements);
      },
    },
  };
});
