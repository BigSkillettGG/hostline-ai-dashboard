import type { IncomingMessage } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeVoiceAdminRequest } from "./admin-auth";
import type { VoiceServiceEnv } from "./env";

const baseEnv: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_1",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  NODE_ENV: "production",
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
  REQUIRE_TWILIO_SIGNATURE: true,
  SUPABASE_SECRET_KEY: "sb_secret_test",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SPEECH_TIMEOUT_MS: 1800,
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  VOICE_SERVICE_ALLOWED_ORIGIN: "https://app.signalhost.ai",
};

describe("authorizeVoiceAdminRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows local development when Supabase is not configured", async () => {
    await expect(
      authorizeVoiceAdminRequest({
        currentEnv: { ...baseEnv, NODE_ENV: "development", SUPABASE_SECRET_KEY: undefined, SUPABASE_URL: undefined },
        req: request(),
      }),
    ).resolves.toMatchObject({ authorized: true });
  });

  it("rejects production admin requests without a Supabase bearer token", async () => {
    await expect(authorizeVoiceAdminRequest({ currentEnv: baseEnv, req: request() })).resolves.toMatchObject({
      authorized: false,
      status: 401,
    });
  });

  it("allows platform admins", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "user_1" }))
      .mockResolvedValueOnce(json([{ id: "platform_admin_1" }]));

    await expect(
      authorizeVoiceAdminRequest({ currentEnv: baseEnv, req: request("valid-token") }),
    ).resolves.toMatchObject({
      authorized: true,
      userId: "user_1",
    });
  });

  it("allows restaurant owners for their location", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "user_1" }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ organization_id: "org_1" }]))
      .mockResolvedValueOnce(json([{ organization_id: "org_1", role: "owner" }]));

    await expect(
      authorizeVoiceAdminRequest({ currentEnv: baseEnv, locationId: "loc_1", req: request("valid-token") }),
    ).resolves.toMatchObject({
      authorized: true,
      userId: "user_1",
    });
  });

  it("allows restaurant managers for operational voice settings", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "user_1" }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ organization_id: "org_1" }]))
      .mockResolvedValueOnce(json([{ organization_id: "org_1", role: "manager" }]));

    await expect(
      authorizeVoiceAdminRequest({ currentEnv: baseEnv, locationId: "loc_1", req: request("valid-token") }),
    ).resolves.toMatchObject({
      authorized: true,
      userId: "user_1",
    });
  });

  it("rejects restaurant staff for voice admin settings", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "user_1" }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ organization_id: "org_1" }]))
      .mockResolvedValueOnce(json([{ organization_id: "org_1", role: "staff" }]));

    await expect(
      authorizeVoiceAdminRequest({ currentEnv: baseEnv, locationId: "loc_1", req: request("valid-token") }),
    ).resolves.toMatchObject({
      authorized: false,
      status: 403,
    });
  });

  it("keeps the legacy internal key path for server-side deployment checks", async () => {
    await expect(
      authorizeVoiceAdminRequest({
        currentEnv: { ...baseEnv, SIGNALHOST_INTERNAL_API_KEY: "server-check-key" },
        req: { headers: { "x-signalhost-api-key": "server-check-key" } } as unknown as IncomingMessage,
      }),
    ).resolves.toMatchObject({ authorized: true });
  });
});

function request(token?: string) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as IncomingMessage;
}

function json(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), init);
}
