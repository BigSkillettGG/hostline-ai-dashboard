import { describe, expect, it } from "vitest";
import { buildConversationRelayTwiML, escapeXml } from "./twiml";

describe("ConversationRelay TwiML", () => {
  it("builds Twilio ConversationRelay XML with ElevenLabs voice settings", () => {
    const xml = buildConversationRelayTwiML({
      actionUrl: "https://voice.hostline.test/twilio/conversation-ended",
      customParameters: { locationId: "loc_123" },
      language: "en-US",
      transcriptionProvider: "Deepgram",
      ttsProvider: "ElevenLabs",
      ttsVoice: "voice123-flash_v2_5-1.0_0.5_0.8",
      websocketUrl: "wss://voice.hostline.test/twilio/conversation-relay",
      welcomeGreeting: "Thanks for calling Olive & Ember.",
    });

    expect(xml).toContain('<ConversationRelay url="wss://voice.hostline.test/twilio/conversation-relay"');
    expect(xml).toContain('ttsProvider="ElevenLabs"');
    expect(xml).toContain('voice="voice123-flash_v2_5-1.0_0.5_0.8"');
    expect(xml).toContain('elevenlabsTextNormalization="on"');
    expect(xml).toContain('<Parameter name="locationId" value="loc_123" />');
  });

  it("escapes XML-sensitive characters", () => {
    expect(escapeXml('Olive & "Ember"')).toBe("Olive &amp; &quot;Ember&quot;");
  });
});
