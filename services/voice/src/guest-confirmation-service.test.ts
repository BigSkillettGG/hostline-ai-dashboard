import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGuestConfirmationService,
  formatGuestOrderConfirmation,
  formatGuestReservationConfirmation,
} from "./guest-confirmation-service";
import type { VoiceServiceEnv } from "./env";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_AUTH_TOKEN: "twilio_secret",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SMS_FROM_NUMBER: "+15550000",
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("guest confirmation service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats concise pickup order confirmations", () => {
    const message = formatGuestOrderConfirmation({
      customerName: "Sarah",
      etaMinutes: 25,
      items: [
        { name: "Margherita Pizza", priceCents: 1800, quantity: 2 },
        { name: "Caesar Salad", priceCents: 1400, quantity: 1 },
      ],
      restaurantName: "Olive & Ember",
    });

    expect(message).toContain("Olive & Ember: Pickup order received for Sarah.");
    expect(message).toContain("Items: 2x Margherita Pizza, 1x Caesar Salad.");
    expect(message).toContain("Pay at pickup");
    expect(message).toContain("Reply STOP");
    expect(message.length).toBeLessThanOrEqual(320);
  });

  it("formats unconfirmed reservation request confirmations", () => {
    expect(
      formatGuestReservationConfirmation({
        date: "2026-05-10",
        guestName: "Nina Rossi",
        partySize: 6,
        restaurantName: "Olive & Ember",
        time: "19:30",
      }),
    ).toContain("Staff will confirm shortly");
  });

  it("sends Twilio order confirmations to the caller", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    const service = createGuestConfirmationService(env);

    await service.sendOrderConfirmation({
      customerName: "Sarah",
      etaMinutes: 25,
      items: [{ name: "Margherita Pizza", priceCents: 1800, quantity: 1 }],
      restaurantName: "Olive & Ember",
      to: "+15551234567",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({ method: "POST" }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("To=%2B15551234567");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("From=%2B15550000");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("Pickup+order+received");
  });

  it("skips Twilio calls when the caller phone is missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const service = createGuestConfirmationService(env);

    await service.sendReservationConfirmation({
      date: "2026-05-10",
      partySize: 2,
      restaurantName: "Olive & Ember",
      time: "19:30",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
