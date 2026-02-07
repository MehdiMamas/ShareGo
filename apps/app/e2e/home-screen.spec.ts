/**
 * e2e test: home screen.
 *
 * verifies that the electron app launches and shows the home screen
 * with the expected elements: title, description, and action buttons.
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

test("should show the home screen with title", async () => {
  const title = page.getByText("ShareGo");
  await expect(title).toBeVisible();
});

test("should show receive button", async () => {
  // the button should contain text related to receiving / showing QR code
  const receiveButton = page.getByRole("button", { name: /receive|show.*qr|show.*code/i });
  await expect(receiveButton).toBeVisible();
});

test("should show send button", async () => {
  const sendButton = page.getByRole("button", { name: /send|scan.*qr|enter.*code/i });
  await expect(sendButton).toBeVisible();
});
