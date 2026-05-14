import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoiceServiceEnv } from "./env";
import { createCustomerFollowUpService } from "./customer-follow-up-service";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  EMAIL_FROM: "SignalHost <hello@signalhost.ai>",
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
  RESEND_API_KEY: "re_test",
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
  VOICE_SERVICE_ALLOWED_ORIGIN: "https://app.signalhost.ai",
};

describe("customer follow-up service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an email follow-up, records it, resolves the customer request, and closes the task", async () => {
    const requestUpdates: unknown[] = [];
    const taskUpdates: unknown[] = [];
    const eventBodies: unknown[] = [];
    const emailBodies: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/staff_tasks?") && init?.method === "GET") {
        return json([
          {
            body: "Customer request ID: 11111111-1111-4111-8111-111111111111\nAsked for package options.",
            id: "task_1",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            title: "Follow up on catering lead",
          },
        ]);
      }

      if (requestUrl.includes("/customer_requests?") && init?.method === "GET") {
        return json([
          {
            details: {
              customerEmail: "guest@example.com",
            },
            id: "11111111-1111-4111-8111-111111111111",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            summary: "Guest wants catering package options.",
            title: "Catering package request",
          },
        ]);
      }

      if (requestUrl === "https://api.resend.com/emails") {
        emailBodies.push(JSON.parse(String(init?.body)));
        return json({ id: "email_123" });
      }

      if (requestUrl.includes("/customer_requests?") && init?.method === "PATCH") {
        requestUpdates.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }

      if (requestUrl.includes("/staff_tasks?") && init?.method === "PATCH") {
        taskUpdates.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }

      if (requestUrl.includes("/message_events")) {
        eventBodies.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const service = createCustomerFollowUpService(env, {
      configured: true,
      provider: "resend",
      async sendEmail(input) {
        const response = await fetch("https://api.resend.com/emails", {
          body: JSON.stringify(input),
          method: "POST",
        });
        const body = await response.json();
        return { id: body.id, provider: "resend", status: "sent" };
      },
    });

    const result = await service.sendFollowUp({
      message: "Thanks for reaching out. We can help with catering packages.",
      taskId: "task_1",
    });

    expect(result).toMatchObject({
      deliveryId: "email_123",
      recipient: "guest@example.com",
      requestId: "11111111-1111-4111-8111-111111111111",
      status: "sent",
      taskId: "task_1",
      taskStatus: "done",
    });
    expect(emailBodies[0]).toMatchObject({
      subject: "Following up: Catering package request",
      to: "guest@example.com",
    });
    expect(requestUpdates[0]).toMatchObject({
      response_channel: "email",
      response_status: "sent",
      response_text: "Thanks for reaching out. We can help with catering packages.",
      status: "resolved",
    });
    expect(taskUpdates[0]).toMatchObject({
      status: "done",
    });
    expect(eventBodies[0]).toMatchObject({
      direction: "outbound",
      provider: "email",
      provider_message_sid: "email_123",
      status: "sent",
      to_phone: "guest@example.com",
    });
  });

  it("accepts a typed recipient when the customer request has no email", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/staff_tasks?") && init?.method === "GET") {
        return json([{ body: null, id: "task_2", location_id: env.SUPABASE_DEMO_LOCATION_ID, title: "Quote follow-up" }]);
      }

      if (requestUrl === "https://api.resend.com/emails") return json({ id: "email_456" });
      if (requestUrl.includes("/staff_tasks?") && init?.method === "PATCH") return new Response(null, { status: 204 });
      if (requestUrl.includes("/message_events")) return new Response(null, { status: 204 });

      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const service = createCustomerFollowUpService(env, {
      configured: true,
      provider: "resend",
      async sendEmail() {
        return { id: "email_456", provider: "resend", status: "sent" };
      },
    });

    const result = await service.sendFollowUp({
      message: "We can help with that estimate.",
      recipientEmail: "owner@example.com",
      taskId: "task_2",
    });

    expect(result.recipient).toBe("owner@example.com");
    expect(result.deliveryId).toBe("email_456");
  });

  it("requires email delivery configuration for sends", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/staff_tasks?") && init?.method === "GET") {
        return json([{ body: "guest@example.com", id: "task_3", location_id: env.SUPABASE_DEMO_LOCATION_ID, title: "Follow up" }]);
      }

      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const service = createCustomerFollowUpService(env, {
      configured: false,
      provider: "none",
      async sendEmail() {
        throw new Error("not configured");
      },
    });

    await expect(service.sendFollowUp({
      message: "Following up.",
      taskId: "task_3",
    })).rejects.toThrow("Email delivery is not configured.");
  });
});

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}
