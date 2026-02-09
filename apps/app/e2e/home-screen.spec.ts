/**
 * e2e test: home screen.
 *
 * verifies that the electron app launches and shows the home screen
 * with the expected elements: title, description, and action buttons.
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

test("should show the home screen with title", async () => {
  const title = page.getByText("ShareGo");
  await expect(title).toBeVisible();
});

test("should show receive button", async () => {
  const receiveButton = page.getByTestId("receive-button");
  await expect(receiveButton).toBeVisible();
});

test("should show send button", async () => {
  const sendButton = page.getByTestId("send-button");
  await expect(sendButton).toBeVisible();
});
