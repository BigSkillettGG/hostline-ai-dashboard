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
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        speed: 1,
      },
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
