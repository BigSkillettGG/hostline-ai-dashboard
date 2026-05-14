import { afterEach, describe, expect, it, vi } from "vitest";
import { createPhoneNumberStore } from "./phone-number-store";
import type { VoiceServiceEnv } from "./env";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 9000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 250,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 550,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.72,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SPEECH_TIMEOUT_MS: 1800,
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("phone number store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a provisioned Twilio number and updates the location", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createPhoneNumberStore(env);

    await store.saveProvisionedNumber(
      {
        forwardingMode: "forward_unanswered",
        locationId: "00000000-0000-4000-8000-000000000002",
        phoneNumber: "+14155550199",
        restaurantMainLine: "+14155550148",
      },
      {
        capabilities: { sms: true, voice: true },
        phoneNumber: "+14155550199",
        providerSid: "PN123",
        status: "in-use",
        voiceWebhookUrl: "https://voice.signalhost.test/twilio/voice?locationId=loc",
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/phone_numbers?on_conflict=provider,phone_number",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"provider_sid":"PN123"');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co/rest/v1/locations?id=eq.00000000-0000-4000-8000-000000000002",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });

  it("allows provisioning when a location has no active unreleased number", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const store = createPhoneNumberStore(env);

    const guard = await store.getLocationProvisioningGuard("00000000-0000-4000-8000-000000000002");

    expect(guard).toEqual({
      allowed: true,
      locationId: "00000000-0000-4000-8000-000000000002",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("phone_numbers?location_id=eq.00000000-0000-4000-8000-000000000002");
  });

  it("blocks provisioning when a location already has an active unreleased number", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([
      {
        id: "phone-number-1",
        phone_number: "+14155550199",
        provider_sid: "PN123",
        status: "in-use",
        trial_grace_ends_at: "2026-05-25T00:00:00.000Z",
      },
    ]), { status: 200 }));
    const store = createPhoneNumberStore(env);

    const guard = await store.getLocationProvisioningGuard(
      "00000000-0000-4000-8000-000000000002",
      new Date("2026-05-13T00:00:00.000Z"),
    );

    expect(guard).toMatchObject({
      allowed: false,
      existingPhoneNumber: "+14155550199",
      existingProviderSid: "PN123",
      existingStatus: "in-use",
      locationId: "00000000-0000-4000-8000-000000000002",
      reason: "active_number_exists",
      trialGraceEndsAt: "2026-05-25T00:00:00.000Z",
    });
  });

  it("marks provisioning as cleanup overdue when the existing trial number is past grace", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([
      {
        id: "phone-number-1",
        phone_number: "+14155550199",
        provider_sid: "PN123",
        status: "trialing",
        trial_grace_ends_at: "2026-05-01T00:00:00.000Z",
      },
    ]), { status: 200 }));
    const store = createPhoneNumberStore(env);

    const guard = await store.getLocationProvisioningGuard(
      "00000000-0000-4000-8000-000000000002",
      new Date("2026-05-13T00:00:00.000Z"),
    );

    expect(guard).toMatchObject({
      allowed: false,
      reason: "trial_grace_expired",
      trialGraceEndsAt: "2026-05-01T00:00:00.000Z",
    });
  });

  it("marks the active location number as paid after billing activation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createPhoneNumberStore(env);

    await store.markLocationNumberPaid({
      locationId: "00000000-0000-4000-8000-000000000002",
      reason: "stripe_checkout_completed",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/phone_numbers?location_id=eq.00000000-0000-4000-8000-000000000002&released_at=is.null&status=in.(provisioned,trialing,in-use,active)",
      expect.objectContaining({
        body: expect.stringContaining('"provisioning_source":"paid"'),
        method: "PATCH",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"trial_ends_at":null');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"trial_grace_ends_at":null');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"status":"active"');
  });
});
