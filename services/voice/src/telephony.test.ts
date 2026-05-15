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

  it("attaches newly provisioned numbers to the configured SIP trunk", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        capabilities: { sms: true, voice: true },
        phone_number: "+16178419996",
        sid: "PN456",
        status: "in-use",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sid: "PN456",
        trunk_sid: "TK123",
      }), { status: 201 }));
    const service = createTelephonyService({
      OPENAI_PROJECT_ID: "proj_123",
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.test",
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "secret",
      TWILIO_API_BASE_URL: "https://api.twilio.com",
      TWILIO_DEFAULT_COUNTRY: "US",
      TWILIO_SIP_TRUNK_SID: "TK123",
      TWILIO_TRUNKING_API_BASE_URL: "https://trunking.twilio.com",
    } as never);

    await expect(service.provisionPhoneNumber({
      locationId: "00000000-0000-4000-8000-000000000001",
      phoneNumber: "+16178419996",
    })).resolves.toMatchObject({
      phoneNumber: "+16178419996",
      providerSid: "PN456",
      routingMode: "openai_realtime_sip",
      voiceWebhookUrl: "https://voice.signalhost.test/openai/realtime/webhook?locationId=00000000-0000-4000-8000-000000000001",
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/IncomingPhoneNumbers.json");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://trunking.twilio.com/v1/Trunks/TK123/PhoneNumbers");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toBe("PhoneNumberSid=PN456");
  });

  it("releases a newly purchased number if SIP trunk attachment fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        capabilities: { sms: true, voice: true },
        phone_number: "+16178419996",
        sid: "PN456",
        status: "in-use",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response("bad trunk", { status: 400 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = createTelephonyService({
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.test",
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "secret",
      TWILIO_API_BASE_URL: "https://api.twilio.com",
      TWILIO_DEFAULT_COUNTRY: "US",
      TWILIO_SIP_TRUNK_SID: "TK123",
      TWILIO_TRUNKING_API_BASE_URL: "https://trunking.twilio.com",
    } as never);

    await expect(service.provisionPhoneNumber({
      locationId: "00000000-0000-4000-8000-000000000001",
      phoneNumber: "+16178419996",
    })).rejects.toThrow(/Twilio Trunking POST failed/);

    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/IncomingPhoneNumbers/PN456.json");
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("DELETE");
  });
});
