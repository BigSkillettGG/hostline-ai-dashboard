import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSmsTwiML, createMessageThreadStore } from "./message-thread-store";
import type { VoiceServiceEnv } from "./env";
import type { OwnerCommandRuntime } from "./owner-command-runtime";

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

describe("message thread store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records outbound texts as routable customer threads", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "thread_123" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createMessageThreadStore(env);

    const result = await store.recordOutboundMessage({
      body: "Olive & Ember: Reservation request received.",
      customerPhone: "(781) 307-2672",
      locationId: "00000000-0000-4000-8000-000000000002",
      providerMessageSid: "SM123",
      restaurantName: "Olive & Ember",
      signalhostPhone: "+15550000",
      threadType: "reservation",
    });

    expect(result.threadId).toBe("thread_123");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/message_threads?select=id",
      expect.objectContaining({ method: "POST" }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"customer_phone":"+17813072672"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"thread_id":"thread_123"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"location_id":"00000000-0000-4000-8000-000000000002"');
  });

  it("routes a clear inbound reply to the active thread and creates a staff task", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: "thread_123",
          location_id: "00000000-0000-4000-8000-000000000002",
          signalhost_phone: "+15550000",
          status: "open",
          thread_type: "reservation",
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "loc", name: "Olive & Ember" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createMessageThreadStore(env);

    const result = await store.handleInboundSms({
      body: "Can we make that 6:30?",
      from: "+17813072672",
      providerMessageSid: "SM_IN",
      to: "+15550000",
    });

    expect(result.status).toBe("routed");
    expect(result.replyMessage).toBe("Got it. I sent that to Olive & Ember.");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"status":"routed"');
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"location_id":"00000000-0000-4000-8000-000000000002"');
    expect(String(fetchMock.mock.calls[4]?.[1]?.body)).toContain("Review customer text reply");
  });

  it("asks the customer to disambiguate when one shared sender has multiple live threads", async () => {
    vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: "thread_1",
          location_id: "00000000-0000-4000-8000-000000000002",
          signalhost_phone: "+15550000",
          status: "open",
          thread_type: "reservation",
        },
        {
          id: "thread_2",
          location_id: "00000000-0000-4000-8000-000000000003",
          signalhost_phone: "+15550000",
          status: "open",
          thread_type: "booking",
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "loc1", name: "Olive & Ember" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "loc2", name: "Schneider Plumbing" }]), { status: 200 }));
    const store = createMessageThreadStore(env);

    const result = await store.handleInboundSms({
      body: "Yes that works",
      from: "+17813072672",
      to: "+15550000",
    });

    expect(result.status).toBe("disambiguation_needed");
    expect(result.replyMessage).toBe("Which business is this for? Reply 1 for Olive & Ember, 2 for Schneider Plumbing.");
  });

  it("runs owner assistant commands for trusted inbound owner texts", async () => {
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
          email: "maria@example.com",
          id: "contact_1",
          location_id: "00000000-0000-4000-8000-000000000002",
          name: "Maria",
          phone: "+14155550148",
          preferred_channel: "sms",
          requires_owner_approval: false,
          trusted_identity_enabled: true,
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createMessageThreadStore(env, { ownerCommandRuntime });

    const result = await store.handleInboundSms({
      body: "Tonight's special is lobster ravioli",
      from: "(415) 555-0148",
      providerMessageSid: "SM_OWNER",
      to: "+15550000",
    });

    expect(result.status).toBe("owner_command");
    expect(result.replyMessage).toContain("Got it. I saved that live update.");
    expect(ownerCommandRuntime.runCommand).toHaveBeenCalledWith(expect.objectContaining({
      channel: "sms",
      locationId: "00000000-0000-4000-8000-000000000002",
      message: "Tonight's special is lobster ravioli",
    }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"status":"owner_command"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"location_id":"00000000-0000-4000-8000-000000000002"');
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"status":"owner_command_reply"');
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"location_id":"00000000-0000-4000-8000-000000000002"');
  });

  it("escapes SMS TwiML replies", () => {
    expect(buildSmsTwiML("A & B < C")).toContain("A &amp; B &lt; C");
  });
});
