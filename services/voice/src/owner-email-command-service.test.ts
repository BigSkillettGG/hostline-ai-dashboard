import { afterEach, describe, expect, it, vi } from "vitest";
import { createOwnerEmailCommandService, extractOwnerEmailCommandMessage } from "./owner-email-command-service";
import type { VoiceServiceEnv } from "./env";
import type { OwnerCommandRuntime } from "./owner-command-runtime";

const env: VoiceServiceEnv = {
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 9000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 250,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 550,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.72,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SPEECH_TIMEOUT_MS: 1800,
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("owner email command service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs trusted owner email commands through the shared runtime", async () => {
    const ownerCommandRuntime: OwnerCommandRuntime = {
      configured: true,
      runCommand: vi.fn().mockResolvedValue({
        applied: true,
        bullets: ["Tonight's special is lobster ravioli."],
        decision: "allowed",
        kind: "live_command",
        message: "Saved",
        ok: true,
        spokenResponse: "Got it. I saved that live update.",
        title: "Live update saved",
      }),
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          can_add_live_updates: true,
          can_approve_permanent_knowledge: true,
          can_manage_alert_preferences: true,
          can_receive_alerts: true,
          can_resolve_customer_requests: true,
          can_use_owner_assistant: true,
          contact_type: "owner",
          email: "owner@example.com",
          id: "contact_1",
          location_id: "00000000-0000-4000-8000-000000000002",
          name: "Maria",
          phone: "+14155550148",
          preferred_channel: "both",
          requires_owner_approval: false,
          trusted_identity_enabled: true,
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = createOwnerEmailCommandService(env, ownerCommandRuntime);

    const result = await service.handleInboundEmail({
      fromEmail: "Maria <OWNER@example.com>",
      providerMessageId: "email_123",
      subject: "Tonight special",
      text: "Tonight's special is lobster ravioli.\n\nOn Monday, someone wrote:",
      toEmail: "updates@signalhost.ai",
    });

    expect(result.status).toBe("processed");
    expect(result.replyMessage).toContain("Got it. I saved that live update.");
    expect(ownerCommandRuntime.runCommand).toHaveBeenCalledWith(expect.objectContaining({
      channel: "email",
      locationId: "00000000-0000-4000-8000-000000000002",
      message: "Tonight's special is lobster ravioli.",
    }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/business_contacts?");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"status":"owner_email_command"');
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"status":"owner_email_reply"');
  });

  it("requires location disambiguation when one email owns multiple businesses", async () => {
    const ownerCommandRuntime: OwnerCommandRuntime = {
      configured: true,
      runCommand: vi.fn(),
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { can_use_owner_assistant: true, contact_type: "owner", email: "owner@example.com", id: "one", location_id: "loc_1", name: "One" },
        { can_use_owner_assistant: true, contact_type: "owner", email: "owner@example.com", id: "two", location_id: "loc_2", name: "Two" },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = createOwnerEmailCommandService(env, ownerCommandRuntime);

    const result = await service.handleInboundEmail({
      fromEmail: "owner@example.com",
      text: "Any urgent calls today?",
    });

    expect(result.status).toBe("ambiguous");
    expect(result.replyMessage).toContain("more than one business");
    expect(ownerCommandRuntime.runCommand).not.toHaveBeenCalled();
  });

  it("falls back to subject when the body is empty", () => {
    expect(extractOwnerEmailCommandMessage({ subject: "Re: We are closed tomorrow" })).toBe("We are closed tomorrow");
  });
});
