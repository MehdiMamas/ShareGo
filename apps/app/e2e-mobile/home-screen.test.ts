/**
 * detox e2e test: home screen (mobile).
 *
 * verifies the home screen loads with expected elements on mobile.
 */

import { device, element, by, expect as detoxExpect } from "detox";

describe("home screen", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("should show the app title", async () => {
    await detoxExpect(element(by.text("ShareGo"))).toBeVisible();
  });

  it("should show receive button", async () => {
    await detoxExpect(element(by.text("Show QR Code / Show Code"))).toBeVisible();
  });

  it("should show send button", async () => {
    await detoxExpect(element(by.text("Scan QR Code / Enter Code"))).toBeVisible();
  });
});
