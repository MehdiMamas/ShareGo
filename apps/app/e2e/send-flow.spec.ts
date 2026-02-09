/**
 * e2e test: send flow.
 *
 * verifies that clicking the send button navigates to the send screen,
 * which shows tabs, code input, and connect button.
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

test("should navigate to send screen when send button is clicked", async () => {
  const sendButton = page.getByTestId("send-button");
  await sendButton.click();

  // send screen shows a back button, confirming navigation worked
  const backButton = page.getByText("back");
  await expect(backButton).toBeVisible({ timeout: 10_000 });
});

test("should show connect button on code tab", async () => {
  // switch to the "enter code" tab using exact text
  const codeTab = page.getByText("enter code", { exact: true });
  await codeTab.click();

  // connect button should now be visible
  const connectButton = page.getByText("connect", { exact: true });
  await expect(connectButton).toBeVisible({ timeout: 5_000 });
});
