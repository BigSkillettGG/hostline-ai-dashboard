export interface VoiceServiceHealth {
  ok: boolean;
  service: string;
  openaiConfigured: boolean;
  elevenLabsConfigured: boolean;
  supabaseConfigured: boolean;
  twilioSignatureRequired: boolean;
}

export const voiceServiceBaseUrl = (import.meta.env.VITE_VOICE_SERVICE_URL ?? "").replace(/\/$/, "");

export function isVoiceServiceConfigured() {
  return Boolean(voiceServiceBaseUrl);
}

export async function fetchVoiceServiceHealth() {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Voice service health check failed with ${response.status}.`);
  }

  return (await response.json()) as VoiceServiceHealth;
}

export async function fetchVoicePreviewAudio(text: string) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/voice/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Voice preview failed with ${response.status}.`);
  }

  return response.blob();
}
