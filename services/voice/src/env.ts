import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  PUBLIC_HTTP_BASE_URL: z.string().url().optional(),
  PUBLIC_WS_BASE_URL: z.string().url().optional(),
  VOICE_SERVICE_ALLOWED_ORIGIN: z.string().default("*"),
  HOSTLINE_INTERNAL_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_DEMO_LOCATION_ID: z.string().uuid().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_BASE_URL: z.string().url().default("https://api.twilio.com"),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_DEFAULT_COUNTRY: z.string().default("US"),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_SMS_FROM_NUMBER: z.string().optional(),
  STAFF_ALERT_SMS_TO: z.string().optional(),
  STAFF_ALERT_WEBHOOK_URL: z.string().url().optional(),
  REQUIRE_TWILIO_SIGNATURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  TWILIO_TTS_PROVIDER: z.enum(["Google", "Amazon", "ElevenLabs"]).default("ElevenLabs"),
  TWILIO_TTS_VOICE: z.string().default("BZgkqPqms7Kj9ulSkVzn-flash_v2_5-1.0_0.5_0.8"),
  TWILIO_ELEVENLABS_MODEL_ID: z.string().default("flash_v2_5"),
  TWILIO_ELEVENLABS_SPEED: z.string().default("1.0"),
  TWILIO_ELEVENLABS_STABILITY: z.string().default("0.5"),
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: z.string().default("0.8"),
  TWILIO_TRANSCRIPTION_PROVIDER: z.enum(["Google", "Deepgram"]).default("Deepgram"),
  TWILIO_LANGUAGE: z.string().default("en-US"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_REPLY_TIMEOUT_MS: z.coerce.number().int().positive().default(4500),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("BZgkqPqms7Kj9ulSkVzn"),
  ELEVENLABS_EVE_VOICE_ID: z.string().default("BZgkqPqms7Kj9ulSkVzn"),
  ELEVENLABS_MICHAEL_VOICE_ID: z.string().default("ljX1ZrXuDIIRVcmiVSyR"),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_flash_v2_5"),
  ELEVENLABS_OUTPUT_FORMAT: z.string().default("mp3_44100_128"),
});

export type VoiceServiceEnv = z.infer<typeof envSchema>;

export interface VoiceServiceReadinessCheck {
  detail: string;
  id: string;
  label: string;
  ready: boolean;
  required: boolean;
}

export interface VoiceServiceReadiness {
  checks: VoiceServiceReadinessCheck[];
  productionReady: boolean;
}

export function loadEnv(): VoiceServiceEnv {
  loadDotEnvFile(".env");
  loadDotEnvFile(".env.local");
  return envSchema.parse(process.env);
}

export function getVoiceServiceReadiness(env: VoiceServiceEnv): VoiceServiceReadiness {
  const checks: VoiceServiceReadinessCheck[] = [
    {
      detail: "Needed so Twilio can reach the voice webhook over HTTPS.",
      id: "public_http_base_url",
      label: "Public HTTP base URL",
      ready: Boolean(env.PUBLIC_HTTP_BASE_URL),
      required: true,
    },
    {
      detail: "Needed for Twilio ConversationRelay websocket audio.",
      id: "public_ws_base_url",
      label: "Public websocket base URL",
      ready: Boolean(env.PUBLIC_WS_BASE_URL),
      required: true,
    },
    {
      detail: "Locks browser calls to the dashboard origin instead of wildcard CORS.",
      id: "allowed_origin",
      label: "Allowed dashboard origin",
      ready: Boolean(env.VOICE_SERVICE_ALLOWED_ORIGIN && env.VOICE_SERVICE_ALLOWED_ORIGIN !== "*"),
      required: true,
    },
    {
      detail: "Protects dashboard-to-voice admin endpoints with Supabase user sessions.",
      id: "dashboard_admin_auth",
      label: "Dashboard admin auth",
      ready: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY),
      required: true,
    },
    {
      detail: "Loads restaurant context, logs calls, and writes operational records.",
      id: "supabase_service_role",
      label: "Supabase service role",
      ready: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID),
      required: true,
    },
    {
      detail: "Generates low-latency restaurant replies when deterministic answers are not enough.",
      id: "openai",
      label: "OpenAI replies",
      ready: Boolean(env.OPENAI_API_KEY),
      required: true,
    },
    {
      detail: "Powers the hosted voice preview and fallback TTS flows.",
      id: "elevenlabs",
      label: "ElevenLabs voice",
      ready: Boolean(env.ELEVENLABS_API_KEY),
      required: true,
    },
    {
      detail: "Searches and provisions phone numbers, then receives inbound calls.",
      id: "twilio_credentials",
      label: "Twilio credentials",
      ready: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
      required: true,
    },
    {
      detail: "Rejects spoofed Twilio webhooks in production.",
      id: "twilio_signatures",
      label: "Twilio signature enforcement",
      ready: Boolean(env.REQUIRE_TWILIO_SIGNATURE && env.TWILIO_AUTH_TOKEN && env.PUBLIC_HTTP_BASE_URL),
      required: true,
    },
    {
      detail: "Sends caller confirmations for captured orders and reservations.",
      id: "guest_confirmations",
      label: "Guest SMS confirmations",
      ready: Boolean(env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_SMS_FROM_NUMBER),
      required: false,
    },
    {
      detail: "Routes staff alerts through SMS or webhook destinations.",
      id: "staff_alerts",
      label: "Staff alert destination",
      ready: Boolean(env.STAFF_ALERT_SMS_TO || env.STAFF_ALERT_WEBHOOK_URL),
      required: false,
    },
  ];

  return {
    checks,
    productionReady: checks.filter((check) => check.required).every((check) => check.ready),
  };
}

function loadDotEnvFile(fileName: string) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
