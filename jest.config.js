module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: ["babel-plugin-flatten-imports.js"],
  coveragePathIgnorePatterns: ["/node_modules/", "/__tests__/"],
  verbose: true,
};
