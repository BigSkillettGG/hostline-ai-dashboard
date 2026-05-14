import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  PUBLIC_HTTP_BASE_URL: z.string().url().optional(),
  PUBLIC_WS_BASE_URL: z.string().url().optional(),
  VOICE_SERVICE_ALLOWED_ORIGIN: z.string().default("*"),
  SIGNALHOST_INTERNAL_API_KEY: z.string().optional(),
  HOSTLINE_INTERNAL_API_KEY: z.string().optional(),
  SIGNALHOST_SMS_THREAD_TTL_DAYS: z.coerce.number().int().positive().max(30).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_DEMO_LOCATION_ID: z.string().uuid().optional(),
  DASHBOARD_PUBLIC_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),
  STRIPE_PORTAL_RETURN_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_BASE_URL: z.string().url().default("https://api.twilio.com"),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_DEFAULT_COUNTRY: z.string().default("US"),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_SMS_FROM_NUMBER: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["resend"]).optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  OWNER_REPORT_WEBHOOK_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  STAFF_ALERT_SMS_TO: z.string().optional(),
  STAFF_ALERT_WEBHOOK_URL: z.string().url().optional(),
  REQUIRE_TWILIO_SIGNATURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  TWILIO_TTS_PROVIDER: z.enum(["Google", "Amazon", "ElevenLabs"]).default("Google"),
  TWILIO_TTS_VOICE: z.string().default("en-US-Standard-H"),
  TWILIO_ELEVENLABS_MODEL_ID: z.string().default("flash_v2_5"),
  TWILIO_ELEVENLABS_SPEED: z.string().default("0.95"),
  TWILIO_ELEVENLABS_STABILITY: z.string().default("0.35"),
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: z.string().default("0.85"),
  TWILIO_TRANSCRIPTION_PROVIDER: z.enum(["Google", "Deepgram"]).default("Deepgram"),
  TWILIO_SPEECH_TIMEOUT_MS: z.coerce.number().int().positive().default(1800),
  TWILIO_LANGUAGE: z.string().default("en-US"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_REPLY_TIMEOUT_MS: z.coerce.number().int().positive().default(4500),
  OPENAI_PROJECT_ID: z.string().optional(),
  OPENAI_TTS_MODEL: z.string().optional(),
  OPENAI_TTS_RESPONSE_FORMAT: z.enum(["mp3", "opus", "wav"]).optional(),
  OPENAI_REALTIME_AIDEN_VOICE: z.string().optional(),
  OPENAI_REALTIME_AVA_VOICE: z.string().optional(),
  OPENAI_REALTIME_FEMALE_VOICE: z.string().optional(),
  OPENAI_REALTIME_MALE_VOICE: z.string().optional(),
  OPENAI_REALTIME_MARCO_VOICE: z.string().optional(),
  OPENAI_REALTIME_MAYA_VOICE: z.string().optional(),
  OPENAI_REALTIME_MILES_VOICE: z.string().optional(),
  OPENAI_REALTIME_MODEL: z.string().optional(),
  OPENAI_REALTIME_NOISE_REDUCTION: z.enum(["near_field", "far_field"]).default("far_field"),
  OPENAI_REALTIME_SPEED: z.string().optional(),
  OPENAI_REALTIME_TURN_DETECTION_MODE: z.enum(["semantic_vad", "server_vad"]).default("server_vad"),
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: z.coerce.number().min(0.05).max(0.95).default(0.72),
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: z.coerce.number().int().min(200).max(2000).default(550),
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: z.coerce.number().int().min(0).max(1000).default(250),
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: z.coerce.number().int().min(5000).max(30000).default(9000),
  OPENAI_REALTIME_INTERRUPT_RESPONSE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OPENAI_REALTIME_TURN_EAGERNESS: z.enum(["low", "medium", "high"]).default("low"),
  OPENAI_REALTIME_THEO_VOICE: z.string().optional(),
  OPENAI_REALTIME_VERA_VOICE: z.string().optional(),
  OPENAI_REALTIME_VOICE: z.string().optional(),
  OPENAI_WEBHOOK_SECRET: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("BZgkqPqms7Kj9ulSkVzn"),
  ELEVENLABS_EVE_VOICE_ID: z.string().default("BZgkqPqms7Kj9ulSkVzn"),
  ELEVENLABS_MICHAEL_VOICE_ID: z.string().default("ljX1ZrXuDIIRVcmiVSyR"),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_flash_v2_5"),
  ELEVENLABS_OUTPUT_FORMAT: z.string().default("mp3_44100_128"),
  TOAST_CLIENT_ID: z.string().optional(),
  TOAST_CLIENT_SECRET: z.string().optional(),
  TOAST_RESTAURANT_GUID: z.string().optional(),
  SQUARE_ACCESS_TOKEN: z.string().optional(),
  SQUARE_LOCATION_ID: z.string().optional(),
  CLOVER_ACCESS_TOKEN: z.string().optional(),
  CLOVER_MERCHANT_ID: z.string().optional(),
  OPENTABLE_API_BASE_URL: z.string().url().optional(),
  OPENTABLE_AUTH_URL: z.string().url().optional(),
  OPENTABLE_CLIENT_ID: z.string().optional(),
  OPENTABLE_CLIENT_SECRET: z.string().optional(),
  OPENTABLE_RESERVATIONS_URL: z.string().url().optional(),
  OPENTABLE_RESTAURANT_ID: z.string().optional(),
  RESY_API_KEY: z.string().optional(),
  RESY_VENUE_ID: z.string().optional(),
  SEVENROOMS_CLIENT_ID: z.string().optional(),
  SEVENROOMS_CLIENT_SECRET: z.string().optional(),
  SEVENROOMS_VENUE_ID: z.string().optional(),
  TOCK_API_KEY: z.string().optional(),
  TOCK_BUSINESS_ID: z.string().optional(),
  YELP_GUEST_MANAGER_API_KEY: z.string().optional(),
  YELP_BUSINESS_ID: z.string().optional(),
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
      detail: "Lets OpenAI handle the live phone conversation over SIP.",
      id: "openai_realtime_sip",
      label: "OpenAI Realtime SIP",
      ready: Boolean(env.OPENAI_API_KEY && env.PUBLIC_HTTP_BASE_URL),
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
      detail: "Creates Stripe checkout sessions, listens for subscription webhooks, and unlocks trial-to-paid conversion.",
      id: "stripe_billing",
      label: "Stripe billing",
      ready: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      required: false,
    },
    {
      detail: "Sends owner reports and staff alerts directly by email.",
      id: "email_delivery",
      label: "Email delivery",
      ready: Boolean((env.EMAIL_PROVIDER === "resend" || env.RESEND_API_KEY) && env.RESEND_API_KEY && env.EMAIL_FROM),
      required: false,
    },
    {
      detail: "Routes staff alerts through SMS or webhook destinations.",
      id: "staff_alerts",
      label: "Staff alert destination",
      ready: Boolean(
        env.STAFF_ALERT_SMS_TO ||
          env.STAFF_ALERT_WEBHOOK_URL ||
          ((env.EMAIL_PROVIDER === "resend" || env.RESEND_API_KEY) && env.RESEND_API_KEY && env.EMAIL_FROM),
      ),
      required: false,
    },
    {
      detail: "Connects captured pickup orders to a restaurant order platform such as Toast, Square, or Clover.",
      id: "ordering_platform",
      label: "Ordering platform integration",
      ready: Boolean(
        (env.TOAST_CLIENT_ID && env.TOAST_CLIENT_SECRET && env.TOAST_RESTAURANT_GUID) ||
          (env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID) ||
          (env.CLOVER_ACCESS_TOKEN && env.CLOVER_MERCHANT_ID),
      ),
      required: false,
    },
    {
      detail: "Connects reservation requests to a restaurant booking platform such as OpenTable, Resy, SevenRooms, Tock, or Yelp Guest Manager.",
      id: "reservation_platform",
      label: "Reservation platform integration",
      ready: Boolean(
        (env.OPENTABLE_CLIENT_ID &&
          env.OPENTABLE_CLIENT_SECRET &&
          env.OPENTABLE_RESTAURANT_ID &&
          env.OPENTABLE_RESERVATIONS_URL) ||
          (env.RESY_API_KEY && env.RESY_VENUE_ID) ||
          (env.SEVENROOMS_CLIENT_ID && env.SEVENROOMS_CLIENT_SECRET && env.SEVENROOMS_VENUE_ID) ||
          (env.TOCK_API_KEY && env.TOCK_BUSINESS_ID) ||
          (env.YELP_GUEST_MANAGER_API_KEY && env.YELP_BUSINESS_ID),
      ),
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
