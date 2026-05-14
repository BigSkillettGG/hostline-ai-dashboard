import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBillingService } from "./billing-service";
import type { BillingStore } from "./billing-store";
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
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 9000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 250,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 550,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.72,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SPEECH_TIMEOUT_MS: 1800,
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  VOICE_SERVICE_ALLOWED_ORIGIN: "https://app.signalhost.ai",
};

describe("billing service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a Stripe checkout session with server-side plan pricing and metadata", async () => {
    const store = createStore();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    }), { status: 200 }));
    const service = createBillingService(env, store);

    const session = await service.createCheckoutSession({
      businessType: "hvac",
      locationId: "loc_123",
      planId: "growth",
      successUrl: "https://app.signalhost.ai/app/billing?checkout=success",
    });

    expect(session.url).toContain("checkout.stripe.com");
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("24900");
    expect(body.get("metadata[organization_id]")).toBe("org_123");
    expect(body.get("subscription_data[metadata][plan_name]")).toBe("Dispatch");
    expect(store.upserts.at(-1)).toMatchObject({
      includedInteractions: 700,
      planId: "growth",
      planName: "Dispatch",
      stripeCheckoutSessionId: "cs_test_123",
    });
  });

  it("persists completed checkout webhooks after verifying the Stripe signature", async () => {
    const store = createStore();
    const phoneNumberStore = createPhoneNumberStore();
    const service = createBillingService(env, store, phoneNumberStore);
    const rawBody = JSON.stringify({
      data: {
        object: {
          customer: "cus_123",
          id: "cs_test_123",
          metadata: {
            included_interactions: "800",
            location_id: "loc_123",
            organization_id: "org_123",
            plan_id: "growth",
            plan_name: "Service",
          },
          subscription: "sub_123",
        },
      },
      type: "checkout.session.completed",
    });

    const result = await service.handleWebhook({
      rawBody,
      signature: signStripePayload(rawBody, env.STRIPE_WEBHOOK_SECRET ?? ""),
    });

    expect(result).toEqual({ handled: true, type: "checkout.session.completed" });
    expect(store.upserts.at(-1)).toMatchObject({
      organizationId: "org_123",
      status: "active",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
    });
    expect(phoneNumberStore.markLocationNumberPaid).toHaveBeenCalledWith({
      locationId: "loc_123",
      reason: "stripe_checkout_completed",
    });
  });

  it("marks a location number paid when Stripe sends an active subscription webhook", async () => {
    const store = createStore();
    const phoneNumberStore = createPhoneNumberStore();
    const service = createBillingService(env, store, phoneNumberStore);
    const rawBody = JSON.stringify({
      data: {
        object: {
          cancel_at_period_end: false,
          current_period_end: 1770000000,
          current_period_start: 1767408000,
          customer: "cus_123",
          id: "sub_123",
          metadata: {
            included_interactions: "800",
            location_id: "loc_123",
            organization_id: "org_123",
            plan_id: "growth",
            plan_name: "Service",
          },
          status: "active",
        },
      },
      type: "customer.subscription.updated",
    });

    const result = await service.handleWebhook({
      rawBody,
      signature: signStripePayload(rawBody, env.STRIPE_WEBHOOK_SECRET ?? ""),
    });

    expect(result).toEqual({ handled: true, type: "customer.subscription.updated" });
    expect(store.upserts.at(-1)).toMatchObject({
      currentPeriodEnd: new Date(1770000000 * 1000).toISOString(),
      organizationId: "org_123",
      status: "active",
      stripeSubscriptionId: "sub_123",
    });
    expect(phoneNumberStore.markLocationNumberPaid).toHaveBeenCalledWith({
      locationId: "loc_123",
      reason: "stripe_subscription_active",
    });
  });
});

function createStore(): BillingStore & { upserts: unknown[] } {
  const upserts: unknown[] = [];
  return {
    configured: true,
    upserts,
    async getAccountByLocation() {
      return null;
    },
    async getLocationOrganizationId() {
      return "org_123";
    },
    async upsertAccount(input) {
      upserts.push(input);
    },
  };
}

function createPhoneNumberStore() {
  return {
    markLocationNumberPaid: vi.fn(async () => undefined),
  };
}

function signStripePayload(rawBody: string, secret: string) {
  const timestamp = "1234567890";
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
