import { afterEach, describe, expect, it, vi } from "vitest";
import { createCallStore } from "./call-store";
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
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("Supabase call store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a call start and returns the Supabase call id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "call_uuid" }]), { status: 201 }),
    );
    const store = createCallStore(env);

    const result = await store.startCall({
      setup: {
        callSid: "CA123",
        from: "+15551234567",
        sessionId: "VX123",
        type: "setup",
      },
    });

    expect(result.callId).toBe("call_uuid");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/calls?on_conflict=external_call_sid&select=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "sb_secret_test",
          Prefer: "return=representation,resolution=merge-duplicates",
        }),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("persists an OpenAI Realtime SIP call start", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "call_uuid" }]), { status: 201 }),
    );
    const store = createCallStore(env);

    const result = await store.startRealtimeCall({
      callerPhone: "+15551234567",
      externalCallId: "CA123",
      externalSessionId: "rtc_123",
      locationId: "00000000-0000-4000-8000-000000000002",
      providerPayload: { openaiCallId: "rtc_123" },
    });

    expect(result.callId).toBe("call_uuid");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/calls?on_conflict=external_call_sid&select=id",
      expect.objectContaining({
        body: expect.stringContaining('"provider":"openai_realtime_sip"'),
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"external_call_sid":"CA123"');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"external_session_id":"rtc_123"');
  });

  it("skips transcript writes until a call id exists", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const store = createCallStore(env);

    await store.addTranscriptTurn({
      speaker: "caller",
      text: "Hello",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still completes calls when live Supabase is missing newer insight columns", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Could not find the 'workflow_status' column of 'calls' in the schema cache", { status: 400 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createCallStore(env);

    await store.completeCall({
      callId: "call_uuid",
      confidence: 88,
      durationSeconds: 42,
      intent: "faq",
      outcome: "resolved",
      status: "resolved",
      summary: "Caller asked about tonight's specials and was answered.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"workflow_status":"resolved"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"duration_seconds":42');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"summary":"Caller asked about tonight\'s specials and was answered."');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).not.toContain("workflow_status");
  });

  it("can reconcile a completed call by provider call id without wiping the summary", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createCallStore(env);

    await store.completeCall({
      durationSeconds: 51,
      externalCallSid: "CA123",
      outcome: "twilio_completed",
      status: "resolved",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/calls?external_call_sid=eq.CA123",
      expect.objectContaining({
        body: expect.stringContaining('"duration_seconds":51'),
        method: "PATCH",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain("summary");
  });

  it("creates a staff-review pickup order with order items", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "order_uuid" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response("", { status: 201 }))
      .mockResolvedValueOnce(new Response("", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createCallStore(env);

    const result = await store.createStaffReviewOrder({
      callId: "call_uuid",
      customerName: "Sarah",
      customerPhone: "+15551234567",
      items: [
        { modifiers: ["Light cheese"], name: "Margherita Pizza", priceCents: 1800, quantity: 2 },
        { name: "Caesar Salad", priceCents: 1400, quantity: 1 },
      ],
      locationId: "00000000-0000-4000-8000-000000000002",
      notes: "SignalHost-created staff-review order.",
    });

    expect(result.orderId).toBe("order_uuid");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/orders?select=id",
      expect.objectContaining({
        body: expect.stringContaining('"total_cents":5000'),
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"location_id":"00000000-0000-4000-8000-000000000002"',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co/rest/v1/order_items",
      expect.objectContaining({
        body: expect.stringContaining('"order_id":"order_uuid"'),
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://example.supabase.co/rest/v1/order_delivery_attempts",
      expect.objectContaining({
        body: expect.stringContaining('"destination":"staff_review"'),
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"source":"voice_agent"');
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://example.supabase.co/rest/v1/calls?id=eq.call_uuid",
      expect.objectContaining({
        body: expect.stringContaining('"intent":"order"'),
        method: "PATCH",
      }),
    );
    expect(String(fetchMock.mock.calls[3]?.[1]?.body)).toContain('"workflow_status":"resolved"');
    expect(String(fetchMock.mock.calls[3]?.[1]?.body)).toContain('"owner_report_bucket":"revenue_opportunity"');
  });

  it("creates a staff follow-up task", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "task_uuid" }]), { status: 201 }));
    const store = createCallStore(env);

    const result = await store.createStaffTask({
      body: "Caller asked for the manager.",
      callId: "call_uuid",
      dueMinutes: 15,
      locationId: "00000000-0000-4000-8000-000000000002",
      priority: "high",
      title: "Follow up with caller",
      type: "manager_callback",
    });

    expect(result.taskId).toBe("task_uuid");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/staff_tasks?select=id",
      expect.objectContaining({
        body: expect.stringContaining('"task_type":"manager_callback"'),
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"priority":"high"');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"location_id":"00000000-0000-4000-8000-000000000002"',
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"call_id":"call_uuid"');
  });

  it("creates a generic customer request and staff task", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "request_uuid" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "task_uuid" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createCallStore(env);

    const result = await store.createCustomerRequest({
      callId: "call_uuid",
      customerName: "Sam",
      customerPhone: "+15551234567",
      details: { issue: "Water heater leaking", service_area: "Newton" },
      locationId: "00000000-0000-4000-8000-000000000002",
      priority: "high",
      requestType: "service_appointment",
      summary: "Sam needs help with a leaking water heater in Newton.",
    });

    expect(result).toEqual({ requestId: "request_uuid", taskId: "task_uuid" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/customer_requests?select=id",
      expect.objectContaining({
        body: expect.stringContaining('"request_type":"service_appointment"'),
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co/rest/v1/staff_tasks?select=id",
      expect.objectContaining({
        body: expect.stringContaining('"task_type":"customer_request"'),
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("Customer request ID: request_uuid");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://example.supabase.co/rest/v1/calls?id=eq.call_uuid",
      expect.objectContaining({
        body: expect.stringContaining('"outcome":"customer_request_created"'),
        method: "PATCH",
      }),
    );
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"follow_up_needed":true');
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain('"owner_report_bucket":"open_follow_up"');
  });

  it("falls back to staff tasks when customer request table is not migrated yet", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("relation customer_requests does not exist", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "task_uuid" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createCallStore(env);

    const result = await store.createCustomerRequest({
      callId: "call_uuid",
      customerPhone: "+15551234567",
      requestType: "quote",
      summary: "Caller wants a quote.",
    });

    expect(result).toEqual({ requestId: undefined, taskId: "task_uuid" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://example.supabase.co/rest/v1/staff_tasks?select=id");
  });

  it("attaches a recording URL to a call by provider call id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const store = createCallStore(env);

    await store.attachCallRecording({
      durationSeconds: 32,
      externalCallSid: "CA123",
      recordingSid: "RE123",
      recordingUrl: "https://api.twilio.com/recordings/RE123.mp3",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/calls?external_call_sid=eq.CA123",
      expect.objectContaining({
        body: expect.stringContaining('"recording_url":"https://api.twilio.com/recordings/RE123.mp3"'),
        method: "PATCH",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"duration_seconds":32');
  });

  it("creates a staff-confirmed reservation request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "reservation_uuid" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createCallStore(env);

    const result = await store.createStaffReviewReservation({
      callId: "call_uuid",
      callerPhone: "+15551234567",
      confidence: 85,
      date: "2026-05-08",
      guestName: "Marcus Webb",
      locationId: "00000000-0000-4000-8000-000000000002",
      notes: "Birthday",
      partySize: 4,
      time: "19:30",
    });

    expect(result.reservationId).toBe("reservation_uuid");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/reservations?select=id",
      expect.objectContaining({
        body: expect.stringContaining('"manual_request":true'),
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"reservation_time":"19:30:00"');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"location_id":"00000000-0000-4000-8000-000000000002"',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co/rest/v1/calls?id=eq.call_uuid",
      expect.objectContaining({
        body: expect.stringContaining('"intent":"reservation"'),
        method: "PATCH",
      }),
    );
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"workflow_status":"needs_follow_up"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"follow_up_needed":true');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"knowledge_gap":false');
  });
});
