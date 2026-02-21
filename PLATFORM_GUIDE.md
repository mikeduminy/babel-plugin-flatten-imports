# Platform-Specific File Resolution Guide

This guide covers using the plugin with platform-specific files, commonly used in React Native projects.

## What are Platform-Specific Files?

Platform-specific files allow you to provide different implementations for different platforms. For example:

```
src/
  utils.js           # Generic/web implementation
  utils.native.js    # React Native implementation
  utils.android.js   # Android-specific implementation
  utils.ios.js       # iOS-specific implementation
```

## How It Works

When you configure the plugin with platforms, it modifies the file resolution order **during the re-export chain traversal**. The plugin resolves through platform-specific files to find the actual declaration, but **outputs the base path without platform suffixes** — your bundler (Metro, Webpack, etc.) will handle the final platform-specific resolution.

```js
// Without platforms configuration:
import { foo } from './barrel'
// Plugin follows: barrel.js → utils.js → declaration
// Outputs: import { foo } from './utils'

// With platforms: ['native']
import { foo } from './barrel'
// Plugin follows: barrel.js → utils.native.js → declaration
// Outputs: import { foo } from './utils'  (no .native suffix!)
// Your bundler will resolve './utils' to './utils.native.js'

// With platforms: ['android', 'native']
import { foo } from './barrel'
// Plugin tries: utils.android.js → utils.native.js → utils.js
// Resolves through: utils.android.js (if it exists)
// Outputs: import { foo } from './utils'  (no .android suffix!)
// Your bundler will resolve './utils' to './utils.android.js'
```

**Key Point:** The plugin uses platform extensions to follow the correct re-export chain, but strips platform suffixes from the output. This ensures your bundler's platform resolution continues to work as expected.

## Configuration

### React Native (All Platforms)

```json
{
  "plugins": [
    ["babel-plugin-flatten-imports", {
      "platforms": ["native"]
    }]
  ]
}
```

### React Native with Platform-Specific Builds

For Android builds:
```json
{
  "plugins": [
    ["babel-plugin-flatten-imports", {
      "platforms": ["android", "native"]
    }]
  ]
}
```

For iOS builds:
```json
{
  "plugins": [
    ["babel-plugin-flatten-imports", {
      "platforms": ["ios", "native"]
    }]
  ]
}
```

### Custom Platforms

You can define any platform suffixes you need:

```json
{
  "plugins": [
    ["babel-plugin-flatten-imports", {
      "platforms": ["mobile", "tablet", "desktop"]
    }]
  ]
}
```

This would resolve:
- `component.mobile.js` before `component.js`
- `component.tablet.js` before `component.js`
- `component.desktop.js` before `component.js`

## Resolution Priority

Platforms are tried in the order specified. Given this configuration:

```json
{
  "platforms": ["android", "native", "web"]
}
```

For an import like `import { foo } from './utils'`, the plugin will try:

1. `utils.android.js`
2. `utils.android.jsx`
3. `utils.android.ts`
4. `utils.android.tsx`
5. `utils.android.mjs`
6. `utils.android.cjs`
7. `utils.native.js`
8. `utils.native.jsx`
9. ... (all extensions for 'native')
10. `utils.web.js`
11. ... (all extensions for 'web')
12. `utils.js`
13. `utils.jsx`
14. `utils.ts`
15. ... (base extensions)

## Use Cases

### 1. React Native with Barrel Files

**Problem:** You have a component library with barrel files, but different implementations for web and native.

```
components/
  Button/
    Button.js         # Web implementation
    Button.native.js  # Native implementation
  Input/
    Input.js
    Input.native.js
  index.js            # Barrel file
```

**barrel file (index.js):**
```js
export { Button } from './Button/Button'
export { Input } from './Input/Input'
```

**Before (without plugin):**
```js
import { Button, Input } from './components'
// Loads: components/index.js
//   → imports from Button/Button.js
//   → imports from Input/Input.js
```

**After (with plugin, platforms: ['native']):**
```js
import { Button } from './components/Button/Button'
import { Input } from './components/Input/Input'
// Resolves through .native.js files, outputs base paths (no .native, no .js)
// Bundler will resolve these to Button.native.js and Input.native.js
```

### 2. Platform-Specific Utilities

**File structure:**
```
utils/
  storage.js           # localStorage for web
  storage.native.js    # AsyncStorage for React Native
  api.js               # fetch API for web
  api.native.js        # Custom networking for native
  index.js             # Barrel
```

**barrel file (index.js):**
```js
export { setItem, getItem } from './storage'
export { makeRequest } from './api'
```

**Configuration:**
```json
{
  "plugins": [
    ["babel-plugin-flatten-imports", {
      "platforms": ["native"]
    }]
  ]
}
```

**Result:**
```js
// Plugin output (both native and web builds):
import { setItem, getItem } from './storage'
import { makeRequest } from './api'

// On native builds: Plugin resolves THROUGH storage.native.js and api.native.js
//                   Outputs: './storage' and './api' (no suffixes)
//                   Bundler resolves to storage.native.js and api.native.js

// On web builds: Plugin resolves THROUGH storage.js and api.js
//                Outputs: './storage' and './api' (no suffixes)
//                Bundler resolves to storage.js and api.js
```

### 3. Android/iOS Specific Features

**File structure:**
```
features/
  camera.js
  camera.android.js    # Android camera APIs
  camera.ios.js        # iOS camera APIs
```

**Android config:**
```json
{
  "platforms": ["android", "native"]
}
```

**iOS config:**
```json
{
  "platforms": ["ios", "native"]
}
```

This allows you to have platform-specific implementations while sharing a common interface.

## Combining with Barrel File Flattening

The real power comes from combining platform-specific resolution with barrel file flattening:

```js
// Source code
import { Button, Input, storage } from '@/components'

// Without plugin (native build)
// 1. Loads @/components/index.js (barrel)
// 2. Barrel loads multiple files
// 3. Each file might load .native.js variants
// = Multiple file loads + barrel overhead

// With plugin (native build, platforms: ['native'])
// 1. Plugin analyzes barrel chain
// 2. Resolves each export through platform-specific files
// 3. Generates direct imports WITHOUT platform suffixes or extensions
// 4. Bundler handles final platform + extension resolution
// = Direct imports to exactly what you need

// Output:
import { Button } from '@/components/Button/Button'
import { Input } from '@/components/Input/Input'
import { storage } from '@/components/storage/storage'
// Note: No .native, no .js - bundler resolves to .native.js files
```

## Debugging

To see which files are being resolved, you can temporarily log the resolution:

```js
// In your babel config
{
  plugins: [
    ["babel-plugin-flatten-imports", {
      platforms: ["native"],
      // The plugin will use these configurations
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
    }]
  ]
}
```

The plugin tries extensions in this order with platforms:
1. Platform-specific extensions first (`.native.js`, `.native.jsx`, etc.)
2. Base extensions last (`.js`, `.jsx`, etc.)

## Best Practices

1. **Order matters**: List platforms from most specific to least specific
   ```json
   { "platforms": ["android", "native", "mobile"] }
   ```

2. **Consistent naming**: Use the same suffix across your codebase
   ```
   ✓ Good: utils.native.js, api.native.js, storage.native.js
   ✗ Bad:  utils.native.js, api.rn.js, storage.reactnative.js
   ```

3. **Fallbacks**: Always provide a base file without suffix for platforms that don't need specific implementations
   ```
   component.ios.js      # iOS-specific
   component.android.js  # Android-specific
   component.js          # Fallback for web/others
   ```

4. **Testing**: Test your builds for each platform to ensure correct resolution
   ```bash
   # Android build
   PLATFORM=android yarn build

   # iOS build
   PLATFORM=ios yarn build
   ```

## Troubleshooting

### Import resolves to wrong platform

**Check:** Platform order in configuration. First matching platform wins.

```json
// If both ios and native exist, will use ios
{ "platforms": ["ios", "native"] }

// If both ios and native exist, will use native
{ "platforms": ["native", "ios"] }
```

### Platform file not being used

**Check:**
1. File extension matches configured extensions
2. File is exported through the barrel correctly
3. The export chain is resolvable

### Unexpected imports in output

**Check:** The source file to ensure it's actually declared there and not re-exported again. The plugin follows the full chain.

## TypeScript Support

Platform-specific files work with TypeScript:

```
utils.ts
utils.native.ts
utils.android.ts
```

Configure with TypeScript extensions:

```json
{
  "plugins": [
    ["babel-plugin-flatten-imports", {
      "platforms": ["native"],
      "extensions": [".ts", ".tsx", ".js", ".jsx"]
    }]
  ]
}
```

## Performance Impact

Platform-specific resolution has minimal performance impact:
- Resolver is cached per configuration
- Platform extensions are pre-computed at plugin initialization
- Resolution happens during Babel transform (already in your build pipeline)

## Examples

See `__tests__/platform-specific.test.js` for comprehensive examples and test cases.
