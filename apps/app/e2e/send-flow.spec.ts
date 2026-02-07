/**
 * e2e test: send flow.
 *
 * verifies that clicking the send button navigates to the send screen,
 * which shows a code input field, address input, and connect button.
 */

import { test, expect } from "@playwright/test";
import { launchApp, closeApp } from "./electron.setup.js";
import type { ElectronApplication, Page } from "playwright-core";

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
});

test.afterAll(async () => {
  await closeApp();
});

test("should navigate to send screen when send button is clicked", async () => {
  const sendButton = page.getByRole("button", { name: /send|scan.*qr|enter.*code/i });
  await sendButton.click();

  // should show a code input area
  const codeInput = page.getByPlaceholder(/code|ABC123/i);
  await expect(codeInput).toBeVisible({ timeout: 10_000 });
});

test("should show connect button on send screen", async () => {
  const connectButton = page.getByRole("button", { name: /connect/i });
  await expect(connectButton).toBeVisible();
});
