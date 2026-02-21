const { transformSync } = require("@babel/core");
const plugin = require("../babel-plugin-flatten-imports");
const path = require("path");

/**
 * Snapshot tests for babel-plugin-flatten-imports
 * These tests capture the exact output to detect any unintended changes
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

describe("babel-plugin-flatten-imports snapshots", () => {
  const testFile = path.join(__dirname, "test-file.js");

  it("should match snapshot for simple barrel import", () => {
    const input = `import { foo, bar } from './fixtures/simple/barrel';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`
"import { foo } from "./fixtures/simple/foo";
import { bar } from "./fixtures/simple/bar";"
`);
  });

  it("should match snapshot for chained re-exports", () => {
    const input = `import { deepFoo } from './fixtures/chained/level1';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`"import { deepFoo } from "./fixtures/chained/source";"`);
  });

  it("should match snapshot for wildcard exports", () => {
    const input = `import { wildcardFoo } from './fixtures/wildcard/barrel';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`"import { wildcardFoo } from "./fixtures/wildcard/foo";"`);
  });

  it("should match snapshot for default export", () => {
    const input = `import defaultFoo from './fixtures/default/barrel';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`"import defaultFoo from "./fixtures/default/source";"`);
  });

  it("should match snapshot for mixed default and named", () => {
    const input = `import defaultFoo, { named } from './fixtures/default/mixed';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`
"import defaultFoo from "./fixtures/default/source";
import { named } from "./fixtures/default/named";"
`);
  });

  it("should match snapshot for aliased imports", () => {
    const input = `import { foo as myFoo, bar as myBar } from './fixtures/simple/barrel';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`
"import { foo as myFoo } from "./fixtures/simple/foo";
import { bar as myBar } from "./fixtures/simple/bar";"
`);
  });

  it("should match snapshot for split sources", () => {
    const input = `import { foo, otherFoo } from './fixtures/split/barrel';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`
"import { foo } from "./fixtures/split/foo";
import { otherFoo } from "./fixtures/split/other";"
`);
  });

  it("should match snapshot for namespace import (unchanged)", () => {
    const input = `import * as all from './fixtures/simple/barrel';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`"import * as all from './fixtures/simple/barrel';"`);
  });

  it("should match snapshot for component library", () => {
    const input = `import { Button, Input, Select } from './fixtures/components/index';`;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`
"import { Button } from "./fixtures/components/Button";
import { Input } from "./fixtures/components/Input";
import { Select } from "./fixtures/components/Select";"
`);
  });

  it("should match snapshot for multiple import statements", () => {
    const input = `
import { foo } from './fixtures/simple/barrel';
import { deepFoo } from './fixtures/chained/level1';
import defaultFoo from './fixtures/default/barrel';
    `;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`
"import { foo } from "./fixtures/simple/foo";
import { deepFoo } from "./fixtures/chained/source";
import defaultFoo from "./fixtures/default/source";"
`);
  });

  it("should match snapshot for complex mixed scenario", () => {
    const input = `
import { Button } from './fixtures/components/index';
import defaultFoo, { named } from './fixtures/default/mixed';
import { foo as myFoo } from './fixtures/simple/barrel';
import * as wildcard from './fixtures/wildcard/barrel';
    `;
    const output = transform(input, testFile);
    expect(output).toMatchInlineSnapshot(`
"import { Button } from "./fixtures/components/Button";
import defaultFoo from "./fixtures/default/source";
import { named } from "./fixtures/default/named";
import { foo as myFoo } from "./fixtures/simple/foo";
import * as wildcard from './fixtures/wildcard/barrel';"
`);
  });
});
