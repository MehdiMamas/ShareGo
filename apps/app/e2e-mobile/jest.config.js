/** @type {import('jest').Config} */
module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/e2e-mobile/**/*.test.ts"],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: "detox/runners/jest/globalSetup",
  globalTeardown: "detox/runners/jest/globalTeardown",
  reporters: ["detox/runners/jest/reporter"],
  testEnvironment: "detox/runners/jest/testEnvironment",
  verbose: true,
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
