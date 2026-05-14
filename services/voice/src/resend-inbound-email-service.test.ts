import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createResendInboundEmailService, verifySvixSignature } from "./resend-inbound-email-service";
import type { EmailDeliveryService } from "./email-delivery-service";
import type { VoiceServiceEnv } from "./env";
import type { OwnerEmailCommandService } from "./owner-email-command-service";

const env = {
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  NODE_ENV: "production",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 9000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 250,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 550,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.72,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  RESEND_API_KEY: "re_test",
  RESEND_WEBHOOK_SECRET: "whsec_dGVzdF9zZWNyZXQ=",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SPEECH_TIMEOUT_MS: 1800,
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
} satisfies VoiceServiceEnv;

describe("Resend inbound email service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies Svix signatures", () => {
    const rawBody = JSON.stringify({ type: "email.received" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signSvix({
      id: "msg_123",
      rawBody,
      secret: env.RESEND_WEBHOOK_SECRET,
      timestamp,
    });

    expect(() =>
      verifySvixSignature({
        headers: {
          "svix-id": "msg_123",
          "svix-signature": signature,
          "svix-timestamp": timestamp,
        },
        rawBody,
        secret: env.RESEND_WEBHOOK_SECRET,
      }),
    ).not.toThrow();
  });

  it("rejects invalid Svix signatures", () => {
    expect(() =>
      verifySvixSignature({
        headers: {
          "svix-id": "msg_123",
          "svix-signature": "v1,bad",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        },
        rawBody: JSON.stringify({ type: "email.received" }),
        secret: env.RESEND_WEBHOOK_SECRET,
      }),
    ).toThrow("Invalid Resend webhook signature");
  });

  it("retrieves a received email, routes the owner command, and replies by email", async () => {
    const ownerEmailCommandService: OwnerEmailCommandService = {
      configured: true,
      handleInboundEmail: vi.fn().mockResolvedValue({
        replyMessage: "Got it. I saved that live update.",
        status: "processed",
      }),
    };
    const emailDeliveryService: EmailDeliveryService = {
      configured: true,
      provider: "resend",
      sendEmail: vi.fn().mockResolvedValue({ provider: "resend", status: "sent" }),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          from: "Owner <owner@example.com>",
          html: "<p>Closed tomorrow.</p>",
          id: "email_123",
          message_id: "<message-1@example.com>",
          subject: "Closed tomorrow",
          text: "Closed tomorrow.",
          to: ["updates+00000000-0000-4000-8000-000000000001@inbound.signalhost.ai"],
        }),
        { status: 200 },
      ),
    );
    const rawBody = JSON.stringify({
      data: { email_id: "email_123" },
      type: "email.received",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const service = createResendInboundEmailService(
      { ...env, OWNER_EMAIL_INBOUND_ADDRESS: "updates@inbound.signalhost.ai" },
      ownerEmailCommandService,
      emailDeliveryService,
    );

    const result = await service.handleWebhook({
      headers: {
        "svix-id": "msg_123",
        "svix-signature": signSvix({ id: "msg_123", rawBody, secret: env.RESEND_WEBHOOK_SECRET, timestamp }),
        "svix-timestamp": timestamp,
      },
      rawBody,
    });

    expect(result).toEqual({
      emailId: "email_123",
      ownerCommandStatus: "processed",
      replyDelivery: "sent",
      status: "processed",
    });
    expect(ownerEmailCommandService.handleInboundEmail).toHaveBeenCalledWith(expect.objectContaining({
      fromEmail: "Owner <owner@example.com>",
      locationId: "00000000-0000-4000-8000-000000000001",
      subject: "Closed tomorrow",
      text: "Closed tomorrow.",
      toEmail: "updates+00000000-0000-4000-8000-000000000001@inbound.signalhost.ai",
    }));
    expect(emailDeliveryService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      headers: {
        "In-Reply-To": "<message-1@example.com>",
        References: "<message-1@example.com>",
      },
      replyTo: "updates@inbound.signalhost.ai",
      subject: "Re: Closed tomorrow",
      text: "Got it. I saved that live update.",
      to: "owner@example.com",
    }));
  });

  it("ignores non-email-received events", async () => {
    const ownerEmailCommandService: OwnerEmailCommandService = {
      configured: true,
      handleInboundEmail: vi.fn(),
    };
    const rawBody = JSON.stringify({ type: "email.sent" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const service = createResendInboundEmailService(env, ownerEmailCommandService, {
      configured: true,
      provider: "resend",
      sendEmail: vi.fn(),
    });

    const result = await service.handleWebhook({
      headers: {
        "svix-id": "msg_123",
        "svix-signature": signSvix({ id: "msg_123", rawBody, secret: env.RESEND_WEBHOOK_SECRET, timestamp }),
        "svix-timestamp": timestamp,
      },
      rawBody,
    });

    expect(result).toEqual({ status: "ignored" });
    expect(ownerEmailCommandService.handleInboundEmail).not.toHaveBeenCalled();
  });
});

function signSvix(input: {
  id: string;
  rawBody: string;
  secret: string;
  timestamp: string;
}) {
  const key = Buffer.from(input.secret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", key)
    .update(`${input.id}.${input.timestamp}.${input.rawBody}`)
    .digest("base64");
  return `v1,${signature}`;
}
