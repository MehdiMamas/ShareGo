import { defineConfig } from "@playwright/test";

/**
 * playwright config for electron e2e tests.
 *
 * these tests launch the electron app in test mode and verify
 * the full user flow: home screen, receive, send, and active session.
 *
 * to run: npx playwright test
 * requires: pnpm run build:electron first
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    trace: "on-first-retry",
  },
});
