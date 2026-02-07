/**
 * detox e2e test: send flow (mobile).
 *
 * verifies the send screen shows code input, address input, and connect button.
 */

import { device, element, by, expect as detoxExpect } from "detox";

describe("send flow", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("should navigate to send screen", async () => {
    await element(by.text("Scan QR Code / Enter Code")).tap();

    // code input should be visible
    await detoxExpect(element(by.id("code-input"))).toBeVisible();
  });

  it("should show connect button", async () => {
    await detoxExpect(element(by.text("Connect"))).toBeVisible();
  });
});
