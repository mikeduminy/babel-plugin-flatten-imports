# Test Guide for babel-plugin-flatten-imports

## Running Tests

```bash
# Install dependencies
yarn install

# Run all tests
yarn test

# Run tests in watch mode (re-runs on file changes)
yarn test:watch

# Run tests with coverage report
yarn test:coverage
```

## Test Structure

The test suite is organized into the following categories:

### 1. Simple Re-exports (`fixtures/simple/`)
Tests basic barrel file patterns where a single file re-exports from multiple sources.

Example:
```js
// barrel.js
export { foo } from './foo';
export { bar } from './bar';
```

### 2. Chained Re-exports (`fixtures/chained/`)
Tests multi-level re-export chains where exports pass through multiple barrel files.

Example:
```js
// level1.js -> level2.js -> level3.js -> source.js
```

### 3. Wildcard Exports (`fixtures/wildcard/`)
Tests `export * from` patterns where exports are spread from other modules.

Example:
```js
// barrel.js
export * from './foo';
export * from './bar';
```

### 4. Default Exports (`fixtures/default/`)
Tests default export re-export patterns.

Example:
```js
// barrel.js
export { default } from './source';
```

### 5. Aliased Exports (`fixtures/aliased/`)
Tests `export { x as y }` patterns where exports are renamed during re-export.

Example:
```js
// barrel.js
export { originalFoo as renamedFoo } from './source';
```

### 6. Platform-Specific Resolution (`fixtures/platform-specific/`)
Tests React Native style platform-specific file resolution.

Example:
```js
// With platforms: ['native']
import { getPlatform } from './utils'
// Resolves to utils.native.js instead of utils.js
```

Covers:
- `.native.js` resolution
- `.android.js` and `.ios.js` resolution
- Platform priority ordering
- Fallback to generic files
- Multiple platforms configuration

### 7. Edge Cases

- **Circular Dependencies** (`fixtures/circular/`): Tests that circular re-exports don't cause infinite loops
- **TypeScript** (`fixtures/typescript/`): Tests TypeScript file handling
- **Components** (`fixtures/components/`): Realistic component library barrel scenario
- **Split Sources** (`fixtures/split/`): Imports that resolve to different source files
- **Partial Resolution** (`fixtures/partial/`): Mixed resolvable and unresolvable imports

## Test Assertions

The tests verify that the plugin:

1. **Flattens import chains**: Imports that go through barrel files are rewritten to point directly to the source
2. **Preserves import aliases**: `import { foo as bar }` maintains the `bar` alias
3. **Groups imports efficiently**: Multiple imports from the same resolved file are grouped together
4. **Handles edge cases gracefully**: Unresolvable imports, namespace imports, and circular dependencies don't cause crashes
5. **Leaves appropriate imports unchanged**: Direct imports and namespace imports remain as-is

## Adding New Tests

To add a new test:

1. Create fixture files in `__tests__/fixtures/your-scenario/`
2. Add test cases in `__tests__/babel-plugin-flatten-imports.test.js`
3. Run tests to verify behavior

Example test case:
```js
it("should handle your scenario", () => {
  const input = `import { foo } from './fixtures/your-scenario/barrel';`;
  const filename = path.join(__dirname, "test-file.js");
  const output = transform(input, filename);

  expect(output).toContain("expected output");
});
```

## Coverage Goals

The test suite aims for high coverage of:

- All export statement types (named, default, wildcard)
- All import statement types (named, default, namespace)
- Re-export chains of various depths
- Error handling and edge cases
- TypeScript syntax support

## Common Issues

### Tests failing with resolution errors
Ensure all fixture files exist and the paths in test cases are correct.

### Plugin not transforming as expected
Check that the fixture files have the correct export statements and the resolution chain is set up properly.

### TypeScript fixtures not parsing
Verify that the Babel parser plugins include "typescript" in the configuration.
