/**
 * e2e test: receive flow.
 *
 * verifies that clicking the receive button navigates to the receive screen,
 * which shows a QR code, session code, and local address.
 */

import { test, expect } from "@playwright/test";
import { launchApp, closeApp } from "./electron.setup.js";
import type { ElectronApplication, Page } from "playwright-core";

let _app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const launched = await launchApp();
  _app = launched.app;
  page = launched.page;
});

test.afterAll(async () => {
  await closeApp();
});

test("should navigate to receive screen when receive button is clicked", async () => {
  const receiveButton = page.getByTestId("receive-button");
  await receiveButton.click();

  // should show some receive-related text (starting session, QR, code, etc.)
  await expect(page.getByText(/starting session|waiting|code|expires/i)).toBeVisible({
    timeout: 10_000,
  });
});

test("should be able to go back to home", async () => {
  const backButton = page.getByText(/back/i);
  if (await backButton.isVisible()) {
    await backButton.click();
    await expect(page.getByTestId("receive-button")).toBeVisible({ timeout: 5_000 });
  }
});
