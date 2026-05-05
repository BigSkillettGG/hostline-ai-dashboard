import { describe, expect, it } from "vitest";
import { buildVoiceWebhookUrl, mapTwilioAvailableNumbers } from "./telephony";

describe("Twilio telephony helpers", () => {
  it("maps available Twilio numbers into HostLine options", () => {
    const numbers = mapTwilioAvailableNumbers({
      available_phone_numbers: [
        {
          capabilities: { MMS: true, SMS: true, voice: true },
          friendly_name: "(415) 555-0100",
          locality: "SAN FRANCISCO",
          phone_number: "+14155550100",
          region: "CA",
        },
        { phone_number: undefined },
      ],
    });

    expect(numbers).toEqual([
      {
        capabilities: { MMS: true, SMS: true, voice: true },
        friendlyName: "(415) 555-0100",
        locality: "SAN FRANCISCO",
        phoneNumber: "+14155550100",
        region: "CA",
      },
    ]);
  });

  it("builds a location-aware Twilio voice webhook URL", () => {
    expect(
      buildVoiceWebhookUrl(
        { PUBLIC_HTTP_BASE_URL: "https://voice.hostline.test/" },
        "00000000-0000-4000-8000-000000000001",
      ),
    ).toBe("https://voice.hostline.test/twilio/voice?locationId=00000000-0000-4000-8000-000000000001");
  });
});
