import {
  buildTwilioElevenLabsVoice,
  normalizeSignalHostVoiceGender,
  resolveSignalHostVoiceId,
} from "../../../src/domain/voice-selection";
import type { VoiceServiceEnv } from "./env";
import type { RestaurantVoiceContext } from "./restaurant-context";

export function resolvePreviewElevenLabsVoiceId(
  env: Pick<
    VoiceServiceEnv,
    | "ELEVENLABS_EVE_VOICE_ID"
    | "ELEVENLABS_MICHAEL_VOICE_ID"
  >,
  voiceGender?: unknown,
) {
  const gender = normalizeSignalHostVoiceGender(voiceGender);
  return resolveSignalHostVoiceId(gender, {
    female: env.ELEVENLABS_EVE_VOICE_ID,
    male: env.ELEVENLABS_MICHAEL_VOICE_ID,
  });
}

export function resolveConversationRelayTtsVoice(
  env: Pick<
    VoiceServiceEnv,
    | "ELEVENLABS_EVE_VOICE_ID"
    | "ELEVENLABS_MICHAEL_VOICE_ID"
    | "TWILIO_ELEVENLABS_MODEL_ID"
    | "TWILIO_ELEVENLABS_SIMILARITY_BOOST"
    | "TWILIO_ELEVENLABS_SPEED"
    | "TWILIO_ELEVENLABS_STABILITY"
    | "TWILIO_TTS_PROVIDER"
    | "TWILIO_TTS_VOICE"
  >,
  context: Pick<RestaurantVoiceContext, "voiceGender" | "voiceProfileId">,
) {
  if (env.TWILIO_TTS_PROVIDER !== "ElevenLabs") return env.TWILIO_TTS_VOICE;

  return buildTwilioElevenLabsVoice({
    gender: context.voiceGender,
    modelId: env.TWILIO_ELEVENLABS_MODEL_ID,
    overrides: {
      female: env.ELEVENLABS_EVE_VOICE_ID,
      male: env.ELEVENLABS_MICHAEL_VOICE_ID,
    },
    voiceProfileId: context.voiceProfileId,
    similarityBoost: env.TWILIO_ELEVENLABS_SIMILARITY_BOOST,
    speed: env.TWILIO_ELEVENLABS_SPEED,
    stability: env.TWILIO_ELEVENLABS_STABILITY,
  });
}
