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
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_DEMO_LOCATION_ID: z.string().uuid().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_BASE_URL: z.string().url().default("https://api.twilio.com"),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_DEFAULT_COUNTRY: z.string().default("US"),
  REQUIRE_TWILIO_SIGNATURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  TWILIO_TTS_PROVIDER: z.enum(["Google", "Amazon", "ElevenLabs"]).default("ElevenLabs"),
  TWILIO_TTS_VOICE: z.string().default("UgBBYS2sOqTuMpoF3BR0-flash_v2_5-1.0_0.5_0.8"),
  TWILIO_TRANSCRIPTION_PROVIDER: z.enum(["Google", "Deepgram"]).default("Deepgram"),
  TWILIO_LANGUAGE: z.string().default("en-US"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("UgBBYS2sOqTuMpoF3BR0"),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_flash_v2_5"),
  ELEVENLABS_OUTPUT_FORMAT: z.string().default("mp3_44100_128"),
});

export type VoiceServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(): VoiceServiceEnv {
  loadDotEnvFile(".env");
  loadDotEnvFile(".env.local");
  return envSchema.parse(process.env);
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
