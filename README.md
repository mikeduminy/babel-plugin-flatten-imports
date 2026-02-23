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

### With Platform-Specific Files (React Native)

For React Native or other platforms with platform-specific file extensions:

```json
{
  "plugins": [
    [
      "babel-plugin-flatten-imports",
      {
        "platforms": ["native", "android", "ios"]
      }
    ]
  ]
}
```

The plugin resolves through platform-specific files during traversal, but outputs base paths (no platform suffixes or extensions):

```js
// Input
import { foo } from "./barrel";

// Plugin resolves through: barrel.js → utils.native.js → declaration
// Output: import { foo } from './utils'  (no .native, no .js)

// Your bundler then resolves './utils' → './utils.native.js'
```

Resolution priority:

- Tries `utils.native.js` before `utils.js`
- Tries `utils.android.js` before `utils.js`
- Tries `utils.ios.js` before `utils.js`

### Programmatic Usage

```js
const babel = require("@babel/core");
const flattenImports = require("babel-plugin-flatten-imports");

const result = babel.transformSync(code, {
  plugins: [
    [
      flattenImports,
      {
        platforms: ["native"],
        // Optional: custom extensions
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    ],
    "typescript",
  ],
  filename: "path/to/your/file.js",
});
```

## Options

| Option           | Type       | Default                                          | Description                                                                          |
| ---------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `platforms`      | `string[]` | `[]`                                             | Platform suffixes for platform-specific files (e.g., `['native', 'android', 'ios']`) |
| `extensions`     | `string[]` | `['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']` | File extensions to resolve                                                           |
| `conditionNames` | `string[]` | `['import', 'module', 'default']`                | Package.json export conditions                                                       |

## Features

- ✅ Flattens multi-level re-export chains
- ✅ Handles `export * from` wildcards
- ✅ Preserves import aliases
- ✅ Groups imports from the same resolved file
- ✅ Supports default exports
- ✅ Handles TypeScript files
- ✅ **Platform-specific file resolution** (React Native `.native.js`, `.android.js`, `.ios.js`)
- ✅ Configurable platform priority
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
