import { describe, expect, it } from "vitest";
import { sampleOnboardingDraft } from "@/domain/onboarding";
import {
  buildOnboardingProfilePayload,
  mapSupabaseCalls,
  mapSupabaseOrders,
  mapSupabasePhoneNumber,
} from "./supabase-rest";

describe("Supabase call mapping", () => {
  it("maps persisted calls and transcript turns into dashboard call records", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: null,
          caller_phone: "+15551234567",
          confidence: null,
          duration_seconds: 42,
          id: "call_1",
          intent: "faq",
          outcome: "unknown",
          started_at: "2026-05-04T20:00:00.000Z",
          status: "new",
          summary: null,
        },
      ],
      [
        {
          call_id: "call_1",
          offset_seconds: 2.4,
          speaker: "caller",
          text: "What time do you close?",
        },
        {
          call_id: "call_1",
          offset_seconds: 4.1,
          speaker: "agent",
          text: "We close at 10 tonight.",
        },
      ],
    );

    expect(calls[0]).toMatchObject({
      caller: "Unknown",
      confidence: 0,
      duration: 42,
      intent: "faq",
      outcome: "unknown",
      phone: "+15551234567",
      status: "new",
    });
    expect(calls[0].transcript).toEqual([
      { speaker: "caller", t: "00:02", text: "What time do you close?" },
      { speaker: "agent", t: "00:04", text: "We close at 10 tonight." },
    ]);
  });

  it("normalizes unexpected enum values", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: "Sam",
          caller_phone: null,
          confidence: 12,
          duration_seconds: null,
          id: "call_2",
          intent: "weird",
          outcome: "also_weird",
          started_at: "2026-05-04T20:00:00.000Z",
          status: "strange",
          summary: "Imported from provider",
        },
      ],
      [],
    );

    expect(calls[0].intent).toBe("other");
    expect(calls[0].outcome).toBe("unknown");
    expect(calls[0].status).toBe("new");
  });
});

describe("Supabase order mapping", () => {
  it("maps persisted orders and items into dashboard order records", () => {
    const orders = mapSupabaseOrders(
      [
        {
          created_at: "2026-05-04T20:15:00.000Z",
          customer_name: "Sarah Chen",
          customer_phone: "+15551234567",
          eta_minutes: 25,
          id: "order_1",
          notes: "Pickup at counter",
          payment_mode: "pay_at_pickup",
          source_call_id: "call_1",
          status: "accepted",
          total_cents: 5300,
        },
      ],
      [
        {
          modifiers: ["Light cheese"],
          name: "Margherita Pizza",
          notes: null,
          order_id: "order_1",
          price_cents: 1800,
          quantity: 1,
        },
        {
          modifiers: [],
          name: "Caesar Salad",
          notes: "Dressing on side",
          order_id: "order_1",
          price_cents: 1400,
          quantity: 1,
        },
      ],
    );

    expect(orders[0]).toMatchObject({
      customer: "Sarah Chen",
      etaMinutes: 25,
      payAtPickup: true,
      phone: "+15551234567",
      sourceCallId: "call_1",
      status: "accepted",
      total: 53,
    });
    expect(orders[0].items).toEqual([
      { modifiers: ["Light cheese"], name: "Margherita Pizza", notes: undefined, price: 18, qty: 1 },
      { modifiers: undefined, name: "Caesar Salad", notes: "Dressing on side", price: 14, qty: 1 },
    ]);
  });

  it("normalizes unexpected order status values", () => {
    const orders = mapSupabaseOrders(
      [
        {
          created_at: "2026-05-04T20:15:00.000Z",
          customer_name: null,
          customer_phone: null,
          eta_minutes: null,
          id: "order_2",
          notes: null,
          payment_mode: null,
          source_call_id: null,
          status: "mystery",
          total_cents: null,
        },
      ],
      [],
    );

    expect(orders[0].customer).toBe("Unknown");
    expect(orders[0].status).toBe("new");
    expect(orders[0].total).toBe(0);
  });
});

describe("Supabase onboarding profile payload", () => {
  it("stores the draft with launch-readiness metadata", () => {
    const payload = buildOnboardingProfilePayload(sampleOnboardingDraft, "location_1");

    expect(payload).toMatchObject({
      draft: sampleOnboardingDraft,
      location_id: "location_1",
      status: "ready_for_test_call",
    });
    expect(payload.completed_required).toBe(payload.total_required);
    expect(payload.progress_percent).toBe(100);
    expect(new Date(payload.updated_at).toString()).not.toBe("Invalid Date");
  });
});

describe("Supabase phone number mapping", () => {
  it("maps persisted Twilio phone-number rows into dashboard records", () => {
    const phoneNumber = mapSupabasePhoneNumber({
      forwarding_mode: "forward_unanswered",
      forwarding_status: "pending_verification",
      id: "pn_1",
      last_verified_at: null,
      phone_number: "+14155550199",
      provider: "twilio",
      provider_sid: "PN123",
      restaurant_main_line: "+14155550148",
      status: "in-use",
      updated_at: "2026-05-05T14:00:00.000Z",
      voice_webhook_url: "https://voice.hostline.test/twilio/voice",
    });

    expect(phoneNumber).toEqual({
      forwardingMode: "forward_unanswered",
      forwardingStatus: "pending_verification",
      id: "pn_1",
      lastVerifiedAt: undefined,
      phoneNumber: "+14155550199",
      provider: "twilio",
      providerSid: "PN123",
      restaurantMainLine: "+14155550148",
      status: "in-use",
      updatedAt: "2026-05-05T14:00:00.000Z",
      voiceWebhookUrl: "https://voice.hostline.test/twilio/voice",
    });
  });
});
