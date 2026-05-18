import { describe, expect, it } from "vitest";
import type { VoiceServiceEnv } from "./env";
import {
  buildLiveKitPilotConfig,
  buildLiveKitTwiML,
  HARBOR_PLUMBING_DEMO_LOCATION_ID,
  isLiveKitPilotLocation,
  shouldRouteTwilioVoiceToLiveKit,
} from "./livekit-handoff";

const baseEnv = {
  LIVEKIT_AGENT_NAME: "signalhost-harbor",
  LIVEKIT_API_KEY: "lk_key",
  LIVEKIT_API_SECRET: "lk_secret",
  LIVEKIT_INBOUND_AUTH_PASSWORD: "bridge-pass",
  LIVEKIT_INBOUND_AUTH_USERNAME: "bridge-user",
  LIVEKIT_KRISP_ENABLED: true,
  LIVEKIT_PHONE_NUMBER: "+17816946083",
  LIVEKIT_ROOM_PREFIX: "harbor-call-",
  LIVEKIT_ROUTE_ON_TWILIO_VOICE: false,
  LIVEKIT_SIP_ENDPOINT: "abc123.sip.livekit.cloud",
  LIVEKIT_URL: "wss://signalhost.livekit.cloud",
  OPENAI_API_KEY: "sk-test",
  PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
  TWILIO_CALL_RECORDING_ENABLED: "true",
} as Partial<VoiceServiceEnv> as VoiceServiceEnv;

describe("LiveKit Harbor handoff", () => {
  it("enables the Harbor demo location by default without changing other locations", () => {
    expect(isLiveKitPilotLocation(baseEnv, HARBOR_PLUMBING_DEMO_LOCATION_ID)).toBe(true);
    expect(isLiveKitPilotLocation(baseEnv, "33333333-3333-4333-8333-333333333333")).toBe(false);
  });

  it("builds a ready Harbor pilot config with Krisp trunk and agent dispatch JSON", () => {
    const config = buildLiveKitPilotConfig(baseEnv, HARBOR_PLUMBING_DEMO_LOCATION_ID);

    expect(config.ready).toBe(true);
    expect(config.callRoutingReady).toBe(true);
    expect(config.agentRuntimeReady).toBe(true);
    expect(config.inboundTrunkJson).toMatchObject({
      trunk: {
        authPassword: "bridge-pass",
        authUsername: "bridge-user",
        krispEnabled: true,
        numbers: ["+17816946083"],
      },
    });
    expect(config.dispatchRuleJson).toMatchObject({
      dispatch_rule: {
        roomConfig: {
          agents: [
            {
              agentName: "signalhost-harbor",
            },
          ],
        },
      },
    });
  });

  it("builds TwiML that bridges Twilio Voice into the LiveKit SIP endpoint", () => {
    const twiml = buildLiveKitTwiML({
      callSid: "CA11111111111111111111111111111111",
      dialedPhone: "(781) 694-6083",
      env: baseEnv,
      locationId: HARBOR_PLUMBING_DEMO_LOCATION_ID,
    });

    expect(twiml).toContain("<Dial record=\"record-from-answer-dual\"");
    expect(twiml).toContain("recordingStatusCallback=\"https://voice.signalhost.ai/twilio/recording-status?");
    expect(twiml).toContain("<Sip username=\"bridge-user\" password=\"bridge-pass\">");
    expect(twiml).toContain("sip:+17816946083@abc123.sip.livekit.cloud;transport=tcp");
    expect(twiml).not.toContain("ConversationRelay");
  });

  it("only routes the normal Twilio webhook to LiveKit when the switch is explicit", () => {
    expect(shouldRouteTwilioVoiceToLiveKit(baseEnv, HARBOR_PLUMBING_DEMO_LOCATION_ID)).toBe(false);
    expect(
      shouldRouteTwilioVoiceToLiveKit(
        { ...baseEnv, LIVEKIT_ROUTE_ON_TWILIO_VOICE: true },
        HARBOR_PLUMBING_DEMO_LOCATION_ID,
      ),
    ).toBe(true);
  });
});
