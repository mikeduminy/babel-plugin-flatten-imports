const path = require("node:path");

const { transformSync } = require("@babel/core");

const plugin = require("../index");

/**
 * Helper to run the plugin on source code
 */
function transform(code, filename) {
  const result = transformSync(code, {
    filename,
    plugins: [plugin],
    babelrc: false,
    configFile: false,
  });
  return result.code;
}

describe("babel-plugin-flatten-imports", () => {
  const testFile = path.join(__dirname, "test-file.js");

  describe("simple re-exports", () => {
    it("should flatten a single-level re-export", () => {
      const input = `import { foo } from './fixtures/simple/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { foo } from "./fixtures/simple/foo";"`,
      );
    });

    it("should handle multiple imports from the same barrel", () => {
      const input = `import { foo, bar } from './fixtures/simple/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import { foo } from "./fixtures/simple/foo";
import { bar } from "./fixtures/simple/bar";"
`);
    });
  });

  describe("chained re-exports", () => {
    it("should follow multi-level re-export chains", () => {
      const input = `import { deepFoo } from './fixtures/chained/level1';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { deepFoo } from "./fixtures/chained/source";"`,
      );
    });

    it("should handle mixed chained and direct exports", () => {
      const input = `import { chained, direct } from './fixtures/chained/mixed';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import { direct } from "./fixtures/chained/mixed";
import { deepFoo as chained } from "./fixtures/chained/source";"
`);
    });
  });

  describe("wildcard exports", () => {
    it("should resolve through export * statements", () => {
      const input = `import { wildcardFoo } from './fixtures/wildcard/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { wildcardFoo } from "./fixtures/wildcard/foo";"`,
      );
    });

    it("should handle multiple export * sources", () => {
      const input = `import { fromA, fromB } from './fixtures/wildcard/multi';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import { fromA } from "./fixtures/wildcard/a";
import { fromB } from "./fixtures/wildcard/b";"
`);
    });
  });

  describe("default exports", () => {
    it("should flatten default export re-exports", () => {
      const input = `import defaultFoo from './fixtures/default/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import defaultFoo from "./fixtures/default/source";"`,
      );
    });

    it("should handle mixed default and named exports", () => {
      const input = `import defaultFoo, { named } from './fixtures/default/mixed';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import defaultFoo from "./fixtures/default/source";
import { named } from "./fixtures/default/named";"
`);
    });
  });

  describe("aliased exports", () => {
    it("should preserve import aliases", () => {
      const input = `import { foo as myFoo } from './fixtures/simple/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { foo as myFoo } from "./fixtures/simple/foo";"`,
      );
    });

    it("should handle export { x as y } chains", () => {
      const input = `import { renamedFoo } from './fixtures/aliased/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { originalFoo as renamedFoo } from "./fixtures/aliased/source";"`,
      );
    });
  });

  describe("edge cases", () => {
    it("should not modify imports that are already at the source", () => {
      const input = `import { foo } from './fixtures/simple/foo';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { foo } from './fixtures/simple/foo';"`,
      );
    });

    it("should preserve namespace imports", () => {
      const input = `import * as all from './fixtures/simple/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import * as all from './fixtures/simple/barrel';"`,
      );
    });

    it("should handle unresolvable imports gracefully", () => {
      const input = `import { something } from 'non-existent-package';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { something } from 'non-existent-package';"`,
      );
    });

    it("should handle side-effect imports", () => {
      const input = `import './fixtures/simple/foo';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`"import './fixtures/simple/foo';"`);
    });

    it("should detect and avoid circular re-exports", () => {
      const input = `import { circular } from './fixtures/circular/a';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(
        `"import { circular } from './fixtures/circular/a';"`,
      );
    });

    it("should handle TypeScript syntax", () => {
      const input = `import { TypedFoo } from './fixtures/typescript/barrel';`;
      const filename = path.join(__dirname, "test-file.ts");
      const output = transform(input, filename);
      expect(output).toMatchInlineSnapshot(
        `"import { TypedFoo } from "./fixtures/typescript/source";"`,
      );
    });

    it("should handle exports that are re-exported as default", () => {
      const input = `import defaultRenamed from './fixtures/default/renamed';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`"import defaultRenamed from './fixtures/default/renamed';"`);
    });
  });

  describe("grouping optimization", () => {
    it("should group multiple imports from the same resolved file", () => {
      const input = `
        import { foo } from './fixtures/simple/barrel';
        import { bar } from './fixtures/simple/barrel';
      `;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import { foo } from "./fixtures/simple/foo";
import { bar } from "./fixtures/simple/bar";"
`);
    });

    it("should create separate imports when specifiers resolve to different files", () => {
      const input = `import { foo, otherFoo } from './fixtures/split/barrel';`;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import { foo } from "./fixtures/split/foo";
import { otherFoo } from "./fixtures/split/other";"
`);
    });
  });

  describe("complex scenarios", () => {
    it("should handle a realistic barrel file scenario", () => {
      const input = `
        import { Button, Input, Select } from './fixtures/components/index';
      `;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import { Button } from "./fixtures/components/Button";
import { Input } from "./fixtures/components/Input";
import { Select } from "./fixtures/components/Select";"
`);
    });

    it("should handle mixed resolvable and unresolvable imports", () => {
      const input = `
        import { foo, unresolvable } from './fixtures/partial/barrel';
      `;
      const output = transform(input, testFile);
      expect(output).toMatchInlineSnapshot(`
"import { unresolvable } from "./fixtures/partial/barrel";
import { foo } from "./fixtures/partial/resolvable";"
`);
    });
  });
});
