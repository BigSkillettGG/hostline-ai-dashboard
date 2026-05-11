export interface ConversationRelayTwiMLConfig {
  actionUrl?: string;
  websocketUrl: string;
  welcomeGreeting?: string;
  language: string;
  ttsProvider: "Google" | "Amazon" | "ElevenLabs";
  ttsVoice: string;
  transcriptionProvider: "Google" | "Deepgram";
  customParameters?: Record<string, string | undefined>;
}

export function buildConversationRelayTwiML(config: ConversationRelayTwiMLConfig) {
  const connectAttributes = serializeAttributes({
    action: config.actionUrl,
  });

  const relayAttributes = serializeAttributes({
    url: config.websocketUrl,
    welcomeGreeting: config.welcomeGreeting,
    welcomeGreetingInterruptible: config.welcomeGreeting ? "speech" : undefined,
    language: config.language,
    ttsProvider: config.ttsProvider,
    voice: config.ttsVoice,
    transcriptionProvider: config.transcriptionProvider,
    interruptible: "speech",
    preemptible: "true",
    elevenlabsTextNormalization: config.ttsProvider === "ElevenLabs" ? "on" : undefined,
  });

  const parameters = Object.entries(config.customParameters ?? {})
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([name, value]) => `      <Parameter${serializeAttributes({ name, value })} />`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Connect${connectAttributes}>`,
    parameters
      ? `    <ConversationRelay${relayAttributes}>\n${parameters}\n    </ConversationRelay>`
      : `    <ConversationRelay${relayAttributes} />`,
    "  </Connect>",
    "</Response>",
  ].join("\n");
}

export function buildEmptyTwiML() {
  return ['<?xml version="1.0" encoding="UTF-8"?>', "<Response />"].join("\n");
}

export function buildUnavailableTwiML(message = "HostLine AI is not configured yet. Please try again soon.") {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Say>${escapeXml(message)}</Say>`,
    "</Response>",
  ].join("\n");
}

function serializeAttributes(attributes: Record<string, string | undefined>) {
  const serialized = Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "")
    .map(([key, value]) => `${key}="${escapeXml(value)}"`);

  return serialized.length ? ` ${serialized.join(" ")}` : "";
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
