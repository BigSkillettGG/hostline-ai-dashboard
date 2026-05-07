import {
  buildTwilioElevenLabsVoice,
  normalizeHostlineVoiceGender,
  resolveHostlineVoiceId,
} from "../../../src/domain/voice-selection";
import type { VoiceServiceEnv } from "./env";
import type { RestaurantVoiceContext } from "./restaurant-context";

export function resolvePreviewElevenLabsVoiceId(
  env: Pick<VoiceServiceEnv, "ELEVENLABS_EVE_VOICE_ID" | "ELEVENLABS_MICHAEL_VOICE_ID">,
  voiceGender?: unknown,
) {
  return resolveHostlineVoiceId(normalizeHostlineVoiceGender(voiceGender), {
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
  context: Pick<RestaurantVoiceContext, "voiceGender">,
) {
  if (env.TWILIO_TTS_PROVIDER !== "ElevenLabs") return env.TWILIO_TTS_VOICE;

  return buildTwilioElevenLabsVoice({
    gender: context.voiceGender,
    modelId: env.TWILIO_ELEVENLABS_MODEL_ID,
    overrides: {
      female: env.ELEVENLABS_EVE_VOICE_ID,
      male: env.ELEVENLABS_MICHAEL_VOICE_ID,
    },
    similarityBoost: env.TWILIO_ELEVENLABS_SIMILARITY_BOOST,
    speed: env.TWILIO_ELEVENLABS_SPEED,
    stability: env.TWILIO_ELEVENLABS_STABILITY,
  });
}
