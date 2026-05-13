import { afterEach, describe, expect, it, vi } from "vitest";
import { createOwnerReportService } from "./owner-report-service";
import type { VoiceServiceEnv } from "./env";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
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
  VOICE_SERVICE_ALLOWED_ORIGIN: "https://app.signalhost.ai",
};

describe("owner report service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates and upserts a daily owner report from Supabase activity", async () => {
    const ownerReportBodies: unknown[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/locations?")) {
        return json([{ id: env.SUPABASE_DEMO_LOCATION_ID, name: "Summit Air", timezone: "America/New_York" }]);
      }

      if (requestUrl.includes("/calls?")) {
        return json([
          {
            caller_name: "Robin",
            caller_phone: "+15550100",
            confidence: 92,
            duration_seconds: 180,
            external_call_sid: "call_1",
            id: "call_1",
            intent: "other",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            outcome: "message_taken",
            recording_url: null,
            started_at: "2026-05-13T14:15:00.000Z",
            status: "new",
            summary: "Caller asked for an emergency no AC appointment and wants a callback.",
            twilio_payload: {},
          },
          {
            caller_name: "Pat",
            caller_phone: "+15550101",
            confidence: 87,
            duration_seconds: 95,
            external_call_sid: "webchat_1",
            id: "call_2",
            intent: "faq",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            outcome: "resolved",
            recording_url: null,
            started_at: "2026-05-13T15:00:00.000Z",
            status: "resolved",
            summary: "Website visitor asked about service area.",
            twilio_payload: { provider: "web_chat" },
          },
        ]);
      }

      if (requestUrl.includes("/orders?")) {
        return json([]);
      }

      if (requestUrl.includes("/reservations?")) {
        return json([]);
      }

      if (requestUrl.includes("/staff_tasks?")) {
        return json([
          {
            assigned_to: null,
            body: "Call Robin back about emergency AC service.",
            call_id: "call_1",
            completed_at: null,
            created_at: "2026-05-13T14:16:00.000Z",
            due_at: null,
            id: "task_1",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            order_id: null,
            priority: "urgent",
            reservation_id: null,
            status: "open",
            task_type: "manager_callback",
            title: "Emergency AC callback",
          },
        ]);
      }

      if (requestUrl.includes("/owner_reports?")) {
        ownerReportBodies.push(JSON.parse(String(init?.body)));
        return json([{ id: "report_1" }]);
      }

      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const service = createOwnerReportService(env);

    const result = await service.generateDailyReport({ now: new Date("2026-05-13T20:00:00.000Z") });

    expect(result.reportId).toBe("report_1");
    expect(result.report.totals.calls).toBe(2);
    expect(result.report.totals.chats).toBe(1);
    expect(result.report.totals.urgent).toBeGreaterThan(0);
    expect(result.report.ownerMessage).toContain("Summit Air");
    expect(ownerReportBodies[0]).toMatchObject({
      location_id: env.SUPABASE_DEMO_LOCATION_ID,
      report_type: "daily",
      status: "ready",
      title: result.report.headline,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("on_conflict=location_id,report_type,period_start"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("is not configured without Supabase service credentials", async () => {
    const service = createOwnerReportService({ ...env, SUPABASE_SECRET_KEY: undefined });

    expect(service.configured).toBe(false);
    await expect(service.generateDailyReport()).rejects.toThrow("Owner reports need");
  });
});

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}
