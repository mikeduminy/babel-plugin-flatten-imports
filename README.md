# babel-plugin-flatten-imports

A Babel plugin that transforms imports passing through barrel files (re-export chains) into direct imports to the source files.

> **De-barrel your imports** - Remove the bottleneck of barrel files and let your imports flow directly to their source.

## What it does

Rewrites import statements to bypass re-export chains and point directly at the file that declares the symbol.

**Before:**

```js
import { foo } from "./barrels/index";
// ...where index.js does: export { foo } from '../foo/index'
// ...where that does:     export { foo } from '../foo/foo'
// ...where that does:     export function foo() {}
```

**After:**

```js
import { foo } from "../../foo/foo";
```

## Installation

```bash
npm install --save-dev babel-plugin-flatten-imports
# or
yarn add -D babel-plugin-flatten-imports
```

## Usage

### Basic Usage

Add to your `.babelrc` or `babel.config.js`:

```json
{
  "plugins": ["babel-plugin-flatten-imports"]
}
```

### Programmatic Usage

```js
const babel = require("@babel/core");
const flattenImports = require("babel-plugin-flatten-imports");

const result = babel.transformSync(code, {
  plugins: [
    [
      flattenImports,
      {
        // Same resolve options as oxc-resolver uses (based on webpack resolver)
        resolve: {
          // Optional: custom extensions
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
        ignore: [/node_modules/], // Optional: ignore patterns (e.g., node_modules)
      },
    ],
    "typescript",
  ],
  filename: "path/to/your/file.js",
});
```

## Options

| Option    | Type       | Default | Description                                                   |
| --------- | ---------- | ------- | ------------------------------------------------------------- |
| `resolve` | `object`   | `{}`    | Resolver options for oxc-resolver (based on webpack resolver) |
| `ignore`  | `RegExp[]` | `[]`    | Patterns to not flatten when encountered                      |

## Features

- ✅ Flattens multi-level re-export chains
- ✅ Handles (ignores) `export * from` wildcards
- ✅ Preserves import aliases
- ✅ Groups imports from the same resolved file
- ✅ Supports default exports
- ✅ Handles TypeScript files
- ✅ Detects and avoids circular dependencies
- ✅ Leaves unresolvable and namespace imports unchanged

## Testing

See [TEST_GUIDE.md](./TEST_GUIDE.md) for detailed testing documentation.

```bash
# Run tests
yarn test

# Watch mode
yarn test:watch

# Coverage report
yarn test:coverage
```

## License

MIT
