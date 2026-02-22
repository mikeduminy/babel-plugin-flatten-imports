const path = require("node:path");

const { transformSync } = require("@babel/core");

const plugin = require("../index");

/**
 * Tests for platform-specific file resolution
 * (e.g., React Native .native.js, .android.js, .ios.js)
 */

function transform(code, filename, pluginOptions = {}) {
  const result = transformSync(code, {
    filename,
    plugins: [[plugin, pluginOptions]],
    babelrc: false,
    configFile: false,
  });
  return result.code;
}

describe("platform-specific file resolution", () => {
  const testFile = path.join(__dirname, "test-file.js");

  describe("without platform configuration", () => {
    it("should resolve to generic .js file by default", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile);

      // Should resolve to utils.js (not utils.native.js)
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".native");
    });
  });

  describe("with native platform", () => {
    const options = { platforms: ["native"] };

    it("should resolve through .native.js and output base path", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, options);

      // Should resolve through utils.native.js but output without platform suffix
      // (bundler will handle platform resolution)
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".native");
    });

    it("should handle multiple imports from native files", () => {
      const input = `import { getPlatform, platformSpecificFunction } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, options);

      expect(output).toContain("getPlatform");
      expect(output).toContain("platformSpecificFunction");
      // Outputs base path, not .native
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".native");
    });

    it("should resolve storage module through native version", () => {
      const input = `import { setItem } from './fixtures/platform-specific/storage';`;
      const output = transform(input, testFile, options);

      // Resolves through storage.native.js but outputs base path
      expect(output).toContain("./fixtures/platform-specific/storage");
      expect(output).not.toContain(".native");
    });

    it("should handle barrel with multiple platform-specific imports", () => {
      const input = `import { getPlatform, setItem } from './fixtures/platform-specific/multi-barrel';`;
      const output = transform(input, testFile, options);

      // Both resolve through native versions but output base paths
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).toContain("./fixtures/platform-specific/storage");
      expect(output).not.toContain(".native");
    });
  });

  describe("with android platform", () => {
    const options = { platforms: ["android"] };

    it("should resolve through .android.js and output base path", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, options);

      // Resolves through utils.android.js but outputs base path
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".android");
    });

    it("should resolve android-only functions", () => {
      const input = `import { androidOnlyFunction } from './fixtures/platform-specific/android-barrel';`;
      const output = transform(input, testFile, options);

      expect(output).toContain("androidOnlyFunction");
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".android");
    });

    it("should fall back to generic file when android version doesn't exist", () => {
      const input = `import { setItem } from './fixtures/platform-specific/storage';`;
      const output = transform(input, testFile, options);

      // storage.android.js doesn't exist, falls back to storage.js
      expect(output).toContain("storage");
      expect(output).not.toContain(".android");
      expect(output).not.toContain(".native");
    });
  });

  describe("with ios platform", () => {
    const options = { platforms: ["ios"] };

    it("should resolve through .ios.js and output base path", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, options);

      // Resolves through utils.ios.js but outputs base path
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".ios");
    });

    it("should resolve ios-only functions", () => {
      const input = `import { iosOnlyFunction } from './fixtures/platform-specific/ios-barrel';`;
      const output = transform(input, testFile, options);

      expect(output).toContain("iosOnlyFunction");
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".ios");
    });
  });

  describe("with multiple platforms", () => {
    it("should prioritize platforms in order", () => {
      // If both native and android exist, should pick first in list
      const options = { platforms: ["native", "android", "ios"] };
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, options);

      // Resolves through utils.native.js (first platform) but outputs base path
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".native");
      expect(output).not.toContain(".android");
      expect(output).not.toContain(".ios");
    });

    it("should use second platform if first doesn't exist", () => {
      // If we look for ios first, but only native exists for storage
      const options = { platforms: ["ios", "native"] };
      const input = `import { setItem } from './fixtures/platform-specific/storage';`;
      const output = transform(input, testFile, options);

      // storage.ios.js doesn't exist, resolves through storage.native.js
      // but outputs base path
      expect(output).toContain("./fixtures/platform-specific/storage");
      expect(output).not.toContain(".ios");
      expect(output).not.toContain(".native");
    });

    it("should handle mixed platform availability", () => {
      const options = { platforms: ["android", "native"] };
      const input = `
        import { getPlatform } from './fixtures/platform-specific/utils';
        import { setItem } from './fixtures/platform-specific/storage';
      `;
      const output = transform(input, testFile, options);

      // utils resolves through android, storage through native
      // both output base paths
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).toContain("./fixtures/platform-specific/storage");
      expect(output).not.toContain(".android");
      expect(output).not.toContain(".native");
    });
  });

  describe("with custom extensions", () => {
    it("should respect custom base extensions", () => {
      const options = {
        platforms: ["native"],
        extensions: [".jsx", ".js"],
      };
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, options);

      // Resolves through .native.js but outputs base path
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".native");
    });

    it("should work with TypeScript extensions", () => {
      const options = {
        platforms: ["native"],
        extensions: [".ts", ".tsx", ".js"],
      };
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, options);

      // Resolves through .native.js and outputs base path
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".native");
    });
  });

  describe("snapshot tests for platforms", () => {
    it("should match snapshot for native platform", () => {
      const input = `import { getPlatform, setItem } from './fixtures/platform-specific/multi-barrel';`;
      const output = transform(input, testFile, { platforms: ["native"] });
      expect(output).toMatchInlineSnapshot(`
"import { getPlatform } from "./fixtures/platform-specific/utils";
import { setItem } from "./fixtures/platform-specific/storage";"
`);
    });

    it("should match snapshot for android platform", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, { platforms: ["android"] });
      expect(output).toMatchInlineSnapshot(
        `"import { getPlatform } from "./fixtures/platform-specific/utils";"`,
      );
    });

    it("should match snapshot for multiple platforms", () => {
      const input = `import { getPlatform, platformSpecificFunction } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, {
        platforms: ["native", "android", "ios"],
      });
      expect(output).toMatchInlineSnapshot(`
"import { getPlatform } from "./fixtures/platform-specific/utils";
import { platformSpecificFunction } from "./fixtures/platform-specific/utils";"
`);
    });
  });

  describe("edge cases with platforms", () => {
    it("should handle empty platforms array", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, { platforms: [] });

      // Should behave like no platforms configured
      expect(output).toContain("utils");
      expect(output).not.toContain(".native");
    });

    it("should handle undefined platforms", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, { platforms: undefined });

      // Should behave like no platforms configured
      expect(output).toContain("utils");
      expect(output).not.toContain(".native");
    });

    it("should handle non-existent platform", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/barrel';`;
      const output = transform(input, testFile, { platforms: ["windows"] });

      // Should fall back to generic .js file
      expect(output).toContain("utils");
      expect(output).not.toContain(".windows");
    });

    it("should work with direct imports (no re-export)", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/utils';`;
      const output = transform(input, testFile, { platforms: ["native"] });

      // Direct import resolves through platform-specific file
      // Outputs base path (bundler handles platform resolution)
      expect(output).toContain("./fixtures/platform-specific/utils");
      expect(output).not.toContain(".native");
    });

    it("should preserve original import if already at platform-specific source", () => {
      const input = `import { getPlatform } from './fixtures/platform-specific/utils.native';`;
      const output = transform(input, testFile, { platforms: ["native"] });

      // Already at source, should output base path
      expect(output).toContain("./fixtures/platform-specific/utils");
      // Platform suffix should be stripped
      expect(output).not.toContain(".native.native"); // shouldn't double-add
    });
  });
});
