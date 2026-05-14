import { afterEach, describe, expect, it, vi } from "vitest";
import { buildVoiceWebhookUrl, createTelephonyService, mapTwilioAvailableNumbers } from "./telephony";

describe("Twilio telephony helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps available Twilio numbers into SignalHost options", () => {
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
        { PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.test/" },
        "00000000-0000-4000-8000-000000000001",
      ),
    ).toBe("https://voice.signalhost.test/twilio/voice?locationId=00000000-0000-4000-8000-000000000001");
  });

  it("looks up an existing incoming Twilio number for manual attach", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      incoming_phone_numbers: [
        {
          capabilities: { sms: true, voice: true },
          phone_number: "+16175550100",
          sid: "PN123",
          status: "in-use",
          voice_url: "https://voice.signalhost.test/openai/realtime/webhook",
        },
      ],
    }), { status: 200 }));
    const service = createTelephonyService({
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "secret",
      TWILIO_API_BASE_URL: "https://api.twilio.com",
      TWILIO_DEFAULT_COUNTRY: "US",
    } as never);

    await expect(service.findIncomingPhoneNumber({ phoneNumber: "+16175550100" })).resolves.toMatchObject({
      phoneNumber: "+16175550100",
      providerSid: "PN123",
      status: "in-use",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("IncomingPhoneNumbers.json?PageSize=1&PhoneNumber=%2B16175550100");
  });
});
