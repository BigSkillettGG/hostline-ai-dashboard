import { resolveSignalHostOpenAIVoice } from "../../../src/domain/voice-selection";
import type { VoiceServiceEnv } from "./env";

const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";

export async function createOpenAIVoicePreview({
  env,
  text,
  voiceGender,
  voiceProfileId,
}: {
  env: Pick<
    VoiceServiceEnv,
    | "OPENAI_API_KEY"
    | "OPENAI_REALTIME_FEMALE_VOICE"
    | "OPENAI_REALTIME_MALE_VOICE"
    | "OPENAI_REALTIME_MARCO_VOICE"
    | "OPENAI_REALTIME_MAYA_VOICE"
    | "OPENAI_REALTIME_THEO_VOICE"
    | "OPENAI_REALTIME_VERA_VOICE"
    | "OPENAI_TTS_MODEL"
    | "OPENAI_TTS_RESPONSE_FORMAT"
  >;
  text: string;
  voiceGender?: unknown;
  voiceProfileId?: unknown;
}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for voice previews.");
  }

  const voice = resolveSignalHostOpenAIVoice(
    typeof voiceProfileId === "string" ? voiceProfileId : typeof voiceGender === "string" ? voiceGender : undefined,
    {
      female: env.OPENAI_REALTIME_FEMALE_VOICE,
      male: env.OPENAI_REALTIME_MALE_VOICE,
      marco: env.OPENAI_REALTIME_MARCO_VOICE || env.OPENAI_REALTIME_MALE_VOICE,
      maya: env.OPENAI_REALTIME_MAYA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE,
      theo: env.OPENAI_REALTIME_THEO_VOICE || env.OPENAI_REALTIME_MALE_VOICE,
      vera: env.OPENAI_REALTIME_VERA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE,
    },
  );
  const responseFormat = env.OPENAI_TTS_RESPONSE_FORMAT || "mp3";

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: env.OPENAI_TTS_MODEL || DEFAULT_OPENAI_TTS_MODEL,
      response_format: responseFormat,
      voice,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI voice preview failed: ${response.status} ${body}`);
  }

  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? contentTypeForResponseFormat(responseFormat),
  };
}

function contentTypeForResponseFormat(format: string) {
  if (format === "wav") return "audio/wav";
  if (format === "opus") return "audio/ogg";
  return "audio/mpeg";
}
