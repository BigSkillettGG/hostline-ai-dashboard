import { describe, expect, it } from "vitest";
import type { VoiceServiceEnv } from "./env";
import {
  buildVoiceRuntimeCatalog,
  normalizeVoiceRuntimeProvider,
  PREFERRED_VOICE_RUNTIME_PROVIDER,
} from "./voice-runtime-provider";

describe("voice runtime provider boundary", () => {
  it("uses Vapi as the preferred runtime without claiming central routing enforcement", () => {
    const catalog = buildVoiceRuntimeCatalog({} as VoiceServiceEnv);

    expect(PREFERRED_VOICE_RUNTIME_PROVIDER).toBe("vapi");
    expect(catalog).toMatchObject({
      preferredProvider: "vapi",
      routingPolicyEnforced: false,
      schemaVersion: 1,
    });
    expect(catalog.providers.map((provider) => [provider.id, provider.lifecycle])).toEqual([
      ["vapi", "preferred"],
      ["openai_realtime_sip", "maintained_fallback"],
      ["twilio_conversation_relay", "legacy_fallback"],
      ["livekit", "quarantined"],
    ]);
  });

  it("requires Vapi enablement and authenticated webhooks before new assignments are ready", () => {
    const catalog = buildVoiceRuntimeCatalog({
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
      VAPI_API_KEY: "vapi_test",
      VAPI_PILOT_ENABLED: true,
      VAPI_WEBHOOK_SECRET: "webhook_secret",
    } as VoiceServiceEnv);
    const vapi = catalog.providers.find((provider) => provider.id === "vapi");

    expect(vapi).toMatchObject({
      configured: true,
      enabled: true,
      readyForNewAssignments: true,
    });

    const unauthenticated = buildVoiceRuntimeCatalog({
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
      VAPI_API_KEY: "vapi_test",
      VAPI_PILOT_ENABLED: true,
    } as VoiceServiceEnv).providers.find((provider) => provider.id === "vapi");

    expect(unauthenticated).toMatchObject({
      configured: true,
      enabled: true,
      readyForNewAssignments: false,
    });
  });

  it("normalizes historical provider labels without rewriting stored values", () => {
    expect(normalizeVoiceRuntimeProvider("vapi_pilot")).toBe("vapi");
    expect(normalizeVoiceRuntimeProvider("OpenAI SIP")).toBe("openai_realtime_sip");
    expect(normalizeVoiceRuntimeProvider("conversation-relay")).toBe("twilio_conversation_relay");
    expect(normalizeVoiceRuntimeProvider("livekit_agent")).toBe("livekit");
    expect(normalizeVoiceRuntimeProvider("unknown_provider")).toBeUndefined();
  });
});
