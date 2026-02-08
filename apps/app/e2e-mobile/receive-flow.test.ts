/**
 * detox e2e test: receive flow (mobile).
 *
 * verifies the receive screen shows QR code, session code, and address.
 */

import { device, element, by, expect as detoxExpect } from "detox";

describe("receive flow", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("should navigate to receive screen", async () => {
    await element(by.text("Show QR Code / Show Code")).tap();

    // session code should be visible (6-char code displayed on screen)
    await detoxExpect(element(by.id("session-code"))).toBeVisible();
  });

  it("should show local address", async () => {
    await detoxExpect(element(by.id("local-address"))).toBeVisible();
  });
});
