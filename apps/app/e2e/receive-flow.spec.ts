/**
 * e2e test: receive flow.
 *
 * verifies that clicking the receive button navigates to the receive screen.
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

  // receive screen shows "starting session..." or a back button
  const backButton = page.getByText("back");
  await expect(backButton).toBeVisible({ timeout: 10_000 });
});
