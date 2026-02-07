/**
 * e2e test: receive flow.
 *
 * verifies that clicking the receive button navigates to the receive screen,
 * which shows a QR code, session code, and local address.
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

test("should navigate to receive screen when receive button is clicked", async () => {
  const receiveButton = page.getByRole("button", { name: /receive|show.*qr|show.*code/i });
  await receiveButton.click();

  // should show a session code (6-character alphanumeric)
  const codeElement = page.getByText(/[A-Z0-9]{6}/);
  await expect(codeElement).toBeVisible({ timeout: 10_000 });
});

test("should show local address on receive screen", async () => {
  // look for an IP address pattern
  const addressElement = page.getByText(/\d+\.\d+\.\d+\.\d+:\d+/);
  await expect(addressElement).toBeVisible({ timeout: 10_000 });
});
