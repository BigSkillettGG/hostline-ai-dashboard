import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoiceServiceEnv } from "./env";
import { createMenuIngestionService, extractReadableText } from "./menu-ingestion-service";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
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

describe("menu ingestion service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts readable menu text from basic HTML", () => {
    const text = extractReadableText(`
      <html>
        <head><style>.hidden { display: none; }</style></head>
        <body>
          <h2>Pizza</h2>
          <p>Margherita - Tomato &amp; mozzarella $18</p>
        </body>
      </html>
    `);

    expect(text).toContain("Pizza");
    expect(text).toContain("Margherita - Tomato & mozzarella $18");
    expect(text).not.toContain("display: none");
  });

  it("processes a queued URL source into menu categories and items", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.startsWith("https://restaurant.test/menu")) {
        return new Response(
          `<h2>Pizza</h2><p>Margherita - Tomato, mozzarella, basil $18</p><p>Diavola - Spicy salami $21</p>`,
          {
            headers: { "Content-Type": "text/html" },
            status: 200,
          },
        );
      }

      if (url.includes("/ingestion_jobs") && method === "GET") {
        return jsonResponse([
          {
            id: "job_1",
            input: {},
            job_type: "menu_source_sync",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            source_id: "source_1",
            status: "queued",
          },
        ]);
      }

      if (url.includes("/menu_sources") && method === "GET") {
        return jsonResponse([
          {
            file_name: null,
            id: "source_1",
            label: "restaurant.test",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            source_type: "url",
            sync_frequency: "daily",
            url: "https://restaurant.test/menu",
          },
        ]);
      }

      if (url.includes("/menu_categories") && method === "POST") {
        return jsonResponse([{ id: "cat_pizza" }]);
      }

      return new Response(null, { status: 204 });
    });

    const service = createMenuIngestionService(env);
    const result = await service.runNext();

    expect(result).toMatchObject({
      categoryCount: 1,
      itemCount: 2,
      jobId: "job_1",
      processed: true,
      status: "completed",
    });

    const menuItemPost = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/menu_items") && init?.method === "POST",
    );
    expect(menuItemPost).toBeTruthy();
    expect(String(menuItemPost?.[1]?.body)).toContain("Margherita");
    expect(String(menuItemPost?.[1]?.body)).toContain('"price_cents":1800');

    const completedJobPatch = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/ingestion_jobs") &&
        init?.method === "PATCH" &&
        String(init.body).includes('"status":"completed"'),
    );
    expect(completedJobPatch).toBeTruthy();
  });

  it("marks private network source URLs as failed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/ingestion_jobs") && method === "GET") {
        return jsonResponse([
          {
            id: "job_private",
            input: {},
            job_type: "menu_source_sync",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            source_id: "source_private",
            status: "queued",
          },
        ]);
      }

      if (url.includes("/menu_sources") && method === "GET") {
        return jsonResponse([
          {
            file_name: null,
            id: "source_private",
            label: "localhost",
            location_id: env.SUPABASE_DEMO_LOCATION_ID,
            source_type: "url",
            sync_frequency: "daily",
            url: "http://localhost/menu",
          },
        ]);
      }

      return new Response(null, { status: 204 });
    });

    const service = createMenuIngestionService(env);
    const result = await service.runNext();

    expect(result).toMatchObject({
      jobId: "job_private",
      processed: true,
      status: "failed",
    });
    expect(result.errorMessage).toContain("private network");
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("http://localhost"))).toBe(false);
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
