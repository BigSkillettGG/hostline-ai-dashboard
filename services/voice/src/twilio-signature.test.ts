import { describe, expect, it } from "vitest";
import { computeTwilioSignature, validateTwilioSignature } from "./twilio-signature";

describe("Twilio signatures", () => {
  it("validates a computed webhook signature", () => {
    const signature = computeTwilioSignature({
      authToken: "secret",
      params: { CallSid: "CA123", From: "+15551234567" },
      url: "https://voice.signalhost.test/twilio/voice",
    });

    expect(
      validateTwilioSignature({
        authToken: "secret",
        expectedSignature: signature,
        params: { From: "+15551234567", CallSid: "CA123" },
        url: "https://voice.signalhost.test/twilio/voice",
      }),
    ).toBe(true);
  });
});
