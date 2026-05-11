import type { VoiceServiceEnv } from "./env";
import { resolvePreviewElevenLabsVoiceId } from "./voice-selection";

export async function createElevenLabsPreview({
  env,
  text,
  voiceGender,
}: {
  env: Pick<
    VoiceServiceEnv,
    | "ELEVENLABS_API_KEY"
    | "ELEVENLABS_EVE_VOICE_ID"
    | "ELEVENLABS_MICHAEL_VOICE_ID"
    | "ELEVENLABS_MODEL_ID"
    | "ELEVENLABS_OUTPUT_FORMAT"
    | "TWILIO_ELEVENLABS_SIMILARITY_BOOST"
    | "TWILIO_ELEVENLABS_SPEED"
    | "TWILIO_ELEVENLABS_STABILITY"
  >;
  text: string;
  voiceGender?: unknown;
}) {
  if (!env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is required for voice previews.");
  }

  const voiceId = resolvePreviewElevenLabsVoiceId(env, voiceGender);
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
  url.searchParams.set("output_format", env.ELEVENLABS_OUTPUT_FORMAT);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: env.ELEVENLABS_MODEL_ID,
      voice_settings: buildElevenLabsPreviewVoiceSettings(env),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs preview failed: ${response.status} ${body}`);
  }

  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

export function buildElevenLabsPreviewVoiceSettings(
  env: Pick<
    VoiceServiceEnv,
    "TWILIO_ELEVENLABS_SIMILARITY_BOOST" | "TWILIO_ELEVENLABS_SPEED" | "TWILIO_ELEVENLABS_STABILITY"
  >,
) {
  return {
    similarity_boost: parseBoundedNumber(env.TWILIO_ELEVENLABS_SIMILARITY_BOOST, 0.85, 0, 1),
    speed: parseBoundedNumber(env.TWILIO_ELEVENLABS_SPEED, 0.95, 0.7, 1.2),
    stability: parseBoundedNumber(env.TWILIO_ELEVENLABS_STABILITY, 0.35, 0, 1),
  };
}

function parseBoundedNumber(value: string, fallback: number, min: number, max: number) {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
