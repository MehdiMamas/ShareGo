/**
 * electron e2e test setup using playwright.
 *
 * launches the electron app and provides a helper to get
 * the browser window for testing.
 *
 * requires: pnpm run build:electron before running tests
 */

import { _electron as electron, type ElectronApplication, type Page } from "playwright-core";
import path from "path";

let electronApp: ElectronApplication | null = null;

/**
 * launch the electron app and return the first window.
 */
export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const mainPath = path.resolve(__dirname, "../dist-electron/main.js");

  electronApp = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  // wait for the first window to be ready
  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");

  return { app: electronApp, page };
}

/**
 * close the electron app after tests.
 */
export async function closeApp(): Promise<void> {
  if (electronApp) {
    await electronApp.close();
    electronApp = null;
  }
}
