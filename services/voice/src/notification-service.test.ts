import { afterEach, describe, expect, it, vi } from "vitest";
import { createStaffNotificationService, formatStaffAlertMessage } from "./notification-service";
import type { VoiceServiceEnv } from "./env";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  STAFF_ALERT_SMS_TO: "+15550999",
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_AUTH_TOKEN: "twilio_secret",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SMS_FROM_NUMBER: "+15550000",
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("staff alert formatting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats order alerts for SMS or webhook delivery", () => {
    expect(
      formatStaffAlertMessage({
        callerPhone: "+14155550148",
        details: ["Items: 2 Margherita Pizza, 1 Caesar Salad", "ETA: 25 min", "Payment: pay at pickup"],
        kind: "order",
        restaurantName: "Olive & Ember",
        summary: "Staff-review pickup order created for Sarah.",
      }),
    ).toContain("New phone order - Olive & Ember");
  });

  it("keeps long caller text bounded for staff channels", () => {
    const message = formatStaffAlertMessage({
      details: [`Caller said: ${"wrong order ".repeat(200)}`],
      kind: "complaint",
      restaurantName: "Olive & Ember",
      summary: "Complaint or refund risk detected.",
    });

    expect(message.length).toBeLessThanOrEqual(900);
    expect(message).toContain("Complaint alert - Olive & Ember");
  });

  it("formats newer alert route kinds", () => {
    expect(
      formatStaffAlertMessage({
        kind: "delivery_failure",
        restaurantName: "Olive & Ember",
        summary: "Printer did not acknowledge ticket.",
      }),
    ).toContain("Order delivery failure - Olive & Ember");
  });

  it("sends SMS alerts to routed Supabase recipients", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              config: {
                routes: {
                  order: {
                    enabled: true,
                    quietHoursEnabled: false,
                    recipients: [
                      { channel: "sms", email: "", id: "counter", name: "Counter", phone: "+15550100" },
                      { channel: "both", email: "gm@example.com", id: "gm", name: "GM", phone: "+15550200" },
                    ],
                    severityThreshold: "low",
                  },
                },
              },
              updated_at: "2026-05-06T12:00:00.000Z",
            },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValue(new Response("{}", { status: 201 }));
    const service = createStaffNotificationService(env);

    await service.sendStaffAlert({
      kind: "order",
      locationId: "00000000-0000-4000-8000-000000000001",
      restaurantName: "Olive & Ember",
      summary: "Staff-review pickup order created.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/rest/v1/alert_routing_configs?");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("To=%2B15550100");
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain("To=%2B15550200");
    expect(fetchMock.mock.calls[3]?.[0]).toBe("https://example.supabase.co/rest/v1/staff_alert_events");
    expect(String(fetchMock.mock.calls[3]?.[1]?.body)).toContain('"status":"sent"');
  });
});
