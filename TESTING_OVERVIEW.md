# Testing Overview

## Summary

Comprehensive test suite created for `babel-plugin-flatten-imports` with:
- **2 test files** with multiple test suites
- **34 fixture files** covering diverse scenarios
- **10 fixture categories** testing different import/export patterns

## Test Files

### 1. `__tests__/babel-plugin-flatten-imports.test.js`
Main test suite with ~20+ test cases covering:
- Simple re-exports
- Chained re-exports (multi-level)
- Wildcard exports (`export *`)
- Default exports
- Aliased exports
- Edge cases (circular deps, TypeScript, namespace imports)
- Grouping optimizations
- Complex real-world scenarios

### 2. `__tests__/snapshots.test.js`
Snapshot tests for regression detection:
- Captures exact output of transformations
- Helps catch unintended changes in future updates
- Covers 11 key scenarios

## Fixture Categories

### `/fixtures/simple/`
Basic barrel file patterns
- `foo.js` - source file
- `bar.js` - source file
- `barrel.js` - re-exports both

### `/fixtures/chained/`
Multi-level re-export chains
- `source.js` - original declaration
- `level3.js` → `level2.js` → `level1.js` - chain of barrels
- `mixed.js` - both chained and direct exports

### `/fixtures/wildcard/`
`export *` patterns
- `foo.js`, `a.js`, `b.js` - source files
- `intermediate.js` - uses `export *`
- `barrel.js` - re-exports via wildcard
- `multi.js` - multiple `export *` statements

### `/fixtures/default/`
Default export re-exports
- `source.js` - default export
- `barrel.js` - re-exports default
- `mixed.js` - both default and named exports
- `named.js` - named export for mixed scenario

### `/fixtures/aliased/`
Renamed exports (`export { x as y }`)
- `source.js` - original function
- `barrel.js` - renames on re-export

### `/fixtures/circular/`
Circular dependency handling
- `a.js` ↔ `b.js` - circular re-exports

### `/fixtures/typescript/`
TypeScript file support
- `source.ts` - interface and function
- `barrel.ts` - TypeScript barrel

### `/fixtures/components/`
Realistic component library scenario
- `Button.js`, `Input.js`, `Select.js` - components
- `index.js` - barrel file (common pattern)

### `/fixtures/split/`
Imports resolving to different sources
- `foo.js`, `other.js` - separate sources
- `barrel.js` - re-exports from both

### `/fixtures/partial/`
Mixed resolvable/unresolvable imports
- `resolvable.js` - can be flattened
- `barrel.js` - has both re-exports and local declarations

## Running Tests

```bash
# Install dependencies first
yarn install

# Run all tests
yarn test

# Watch mode (auto-rerun on changes)
yarn test:watch

# Generate coverage report
yarn test:coverage
```

## Test Coverage

The test suite covers:
- ✅ All export types (named, default, wildcard)
- ✅ All import types (named, default, namespace)
- ✅ Re-export chains of varying depths (1-4 levels)
- ✅ Error handling (unresolvable, circular)
- ✅ TypeScript syntax
- ✅ Import aliasing
- ✅ Edge cases (namespace imports, side-effect imports)
- ✅ Real-world patterns (component libraries)

## Files Created

```
decask/
├── __tests__/
│   ├── babel-plugin-flatten-imports.test.js  # Main test suite
│   ├── snapshots.test.js                     # Snapshot tests
│   └── fixtures/                             # Test fixtures (34 files)
│       ├── simple/
│       ├── chained/
│       ├── wildcard/
│       ├── default/
│       ├── aliased/
│       ├── circular/
│       ├── typescript/
│       ├── components/
│       ├── split/
│       └── partial/
├── jest.config.js                            # Jest configuration
├── TEST_GUIDE.md                             # Detailed testing docs
├── TESTING_OVERVIEW.md                       # This file
└── package.json                              # Updated with test scripts
```

## Next Steps

1. Run `yarn install` to install dependencies
2. Run `yarn test` to execute the test suite
3. Review test output and snapshots
4. Update snapshots if needed: `yarn test -u`
5. Check coverage: `yarn test:coverage`
