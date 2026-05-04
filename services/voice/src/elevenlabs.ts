import type { VoiceServiceEnv } from "./env";

export async function createElevenLabsPreview({
  env,
  text,
}: {
  env: Pick<VoiceServiceEnv, "ELEVENLABS_API_KEY" | "ELEVENLABS_MODEL_ID" | "ELEVENLABS_OUTPUT_FORMAT" | "ELEVENLABS_VOICE_ID">;
  text: string;
}) {
  if (!env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is required for voice previews.");
  }

  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}`);
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
