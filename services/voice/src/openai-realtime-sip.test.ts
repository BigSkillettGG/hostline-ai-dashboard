import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { VoiceServiceEnv } from "./env";
import {
  buildOpenAIRealtimeAcceptPayload,
  buildOpenAIRealtimeInstructions,
  buildOpenAIRealtimeLiveCallConfig,
  buildOpeningGreetingInstructions,
  buildOpenAIRealtimePreflight,
  buildRestaurantLocalTimeContext,
  buildShortOpeningGreeting,
  createOpenAIRealtimeReservationRequest,
  createOpenAIRealtimeSipService,
  extractOpenAIRealtimeCallId,
  extractOpenAIRealtimeCallerPhone,
  extractOpenAIRealtimeExternalCallId,
  extractOpenAIRealtimeSipCallId,
  extractOpenAIRealtimeTranscriptTurn,
  extractOpenAIRealtimeToolCalls,
  lookupRestaurantContext,
  requestOpenAIRealtimeStaffCallback,
  resolveOpenAIRealtimeSpeed,
  sendOpenAIRealtimeGuestConfirmation,
  verifyOpenAIWebhookSignature,
} from "./openai-realtime-sip";
import { demoRestaurantContext, type RestaurantVoiceContext } from "./restaurant-context";

const baseEnv = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  PUBLIC_HTTP_BASE_URL: "https://voice.hostline.ai/",
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
} satisfies Partial<VoiceServiceEnv>;

describe("OpenAI Realtime SIP", () => {
  it("builds the pilot webhook and SIP configuration", () => {
    const config = buildOpenAIRealtimeLiveCallConfig(
      {
        ...baseEnv,
        OPENAI_PROJECT_ID: "proj_123",
      },
      "loc_123",
    );

    expect(config).toMatchObject({
      model: "gpt-realtime",
      projectIdConfigured: true,
      ready: true,
      sipUri: "sip:proj_123@sip.api.openai.com;transport=tls",
      voice: "marin",
      webhookSecretConfigured: false,
      webhookUrl: "https://voice.hostline.ai/openai/realtime/webhook?locationId=loc_123",
    });
  });

  it("configures semantic VAD, restaurant instructions, and realtime tools", () => {
    const payload = buildOpenAIRealtimeAcceptPayload({
      context: demoRestaurantContext,
      env: baseEnv,
    });

    expect(payload).toMatchObject({
      model: "gpt-realtime",
      output_modalities: ["audio"],
      tool_choice: "auto",
      type: "realtime",
    });
    expect(payload.audio.input.turn_detection).toMatchObject({
      create_response: true,
      eagerness: "medium",
      interrupt_response: true,
      type: "semantic_vad",
    });
    expect(payload.audio.output.voice).toBe("marin");
    expect(payload.audio.output.speed).toBe(1.02);
    expect(payload.instructions).toContain("Never restart the opening greeting");
    expect(payload.instructions).toContain("Hi, thank you for calling Olive and Ember. How can I help you?");
    expect(payload.instructions).toContain("do not say you are virtual or AI");
    expect(payload.instructions).toContain("Avoid IVR cadence");
    expect(payload.instructions).toContain("There is no live staff transfer");
    expect(payload.instructions).toContain("substitutions or off-menu requests");
    expect(payload.instructions).toContain("create_reservation_request");
    expect(payload.tools[0].name).toBe("lookup_restaurant_context");
    expect(payload.tools.map((tool) => tool.name)).toContain("send_guest_confirmation");
    expect(payload.tools.map((tool) => tool.name)).toContain("create_reservation_request");
    expect(payload.tools.map((tool) => tool.name)).toContain("request_staff_callback");
  });

  it("adds restaurant-local time and caller phone context to realtime instructions", () => {
    const instructions = buildOpenAIRealtimeInstructions(demoRestaurantContext, {
      callerPhone: "+14155550123",
      now: new Date("2026-05-12T01:30:00.000Z"),
    });

    expect(instructions).toContain("Current restaurant local time");
    expect(instructions).toContain("Monday, May 11, 2026");
    expect(instructions).toContain("6:30 PM");
    expect(instructions).toContain("Caller phone number from SIP caller ID: +14155550123");
    expect(instructions).toContain("send_guest_confirmation");
  });

  it("formats restaurant-local time in the restaurant timezone", () => {
    expect(buildRestaurantLocalTimeContext(demoRestaurantContext, new Date("2026-05-12T01:30:00.000Z"))).toContain(
      "Monday, May 11, 2026",
    );
  });

  it("preflights the realtime model and restaurant context before SIP testing", async () => {
    const fetchMock = async () => new Response(JSON.stringify({ id: "gpt-realtime" }), { status: 200 });
    const preflight = await buildOpenAIRealtimePreflight({
      env: {
        ...baseEnv,
        OPENAI_PROJECT_ID: "proj_123",
      },
      fetchImpl: fetchMock as typeof fetch,
      locationId: "loc_123",
      restaurantContextStore: {
        async getContext() {
          return demoRestaurantContext;
        },
      },
    });

    expect(preflight.ready).toBe(true);
    expect(preflight.config.webhookUrl).toBe("https://voice.hostline.ai/openai/realtime/webhook?locationId=loc_123");
    expect(preflight.checks.find((check) => check.id === "openai_realtime_model")).toMatchObject({ ready: true });
    expect(preflight.restaurantName).toBe("Olive & Ember");
  });

  it("starts and completes a persisted call for incoming SIP webhooks", async () => {
    const socket = createFakeRealtimeSocket();
    const startedCalls: unknown[] = [];
    const transcriptTurns: unknown[] = [];
    const completedCalls: unknown[] = [];
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return demoRestaurantContext;
        },
      },
      {
        callStore: {
          async addTranscriptTurn(input) {
            transcriptTurns.push(input);
          },
          async attachCallRecording() {},
          async completeCall(input) {
            completedCalls.push(input);
          },
          async createStaffReviewOrder() {
            return {};
          },
          async createStaffReviewReservation() {
            return {};
          },
          async createStaffTask() {
            return {};
          },
          async startCall() {
            return {};
          },
          async startRealtimeCall(input) {
            startedCalls.push(input);
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    const result = await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_123",
          sip_headers: [
            { name: "X-Twilio-CallSid", value: "CA123" },
            { name: "Call-ID", value: "sip-call-123" },
            { name: "From", value: "sip:+14155550123@twilio.com" },
          ],
        },
        id: "evt_123",
        object: "event",
        type: "realtime.call.incoming",
      }),
    });

    expect(result.status).toBe(200);
    expect(startedCalls[0]).toMatchObject({
      callerPhone: "+14155550123",
      externalCallId: "CA123",
      externalSessionId: "sip-call-123",
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "item_1",
        transcript: "What time do you close tonight?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();
    expect(transcriptTurns[0]).toMatchObject({
      callId: "call_uuid",
      speaker: "caller",
      text: "What time do you close tonight?",
    });

    socket.emit("close", 1000, Buffer.from("normal"));
    await Promise.resolve();
    await Promise.resolve();
    expect(completedCalls[0]).toMatchObject({
      callId: "call_uuid",
      intent: "hours",
      status: "resolved",
    });
  });

  it("uses the male OpenAI voice for male configured hosts", () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      voiceGender: "male",
    };

    const payload = buildOpenAIRealtimeAcceptPayload({
      context,
      env: baseEnv,
    });

    expect(payload.audio.output.voice).toBe("cedar");
  });

  it("keeps the no-mid-call-restart guidance in the reusable instructions", () => {
    const instructions = buildOpenAIRealtimeInstructions(demoRestaurantContext);

    expect(instructions).toContain("one continuous live phone call");
    expect(instructions).toContain("Say the opening greeting once");
    expect(instructions).toContain("If the caller says 'hello' before you have greeted them");
    expect(instructions).toContain("Greeting energy");
    expect(instructions).toContain("not 'Thanks, Schneider.'");
    expect(instructions).toContain("Handle interruptions gracefully");
    expect(instructions).toContain("Never say you are connecting, transferring, or placing the caller on hold");
  });

  it("builds a short opening greeting that does not introduce the host", () => {
    expect(buildShortOpeningGreeting(demoRestaurantContext)).toBe(
      "Hi, thank you for calling Olive and Ember. How can I help you?",
    );
  });

  it("builds a warm opening greeting prompt using the short greeting", () => {
    const instructions = buildOpeningGreetingInstructions(demoRestaurantContext);

    expect(instructions).toContain("Say this exact opening greeting once");
    expect(instructions).toContain("Hi, thank you for calling Olive and Ember. How can I help you?");
    expect(instructions).toContain("smile in your voice");
    expect(instructions).toContain("Do not add your name");
  });

  it("clamps realtime playback speed to a safe phone range", () => {
    expect(resolveOpenAIRealtimeSpeed({ ...baseEnv, OPENAI_REALTIME_SPEED: "1.08" })).toBe(1.08);
    expect(resolveOpenAIRealtimeSpeed({ ...baseEnv, OPENAI_REALTIME_SPEED: "2" })).toBe(1.12);
    expect(resolveOpenAIRealtimeSpeed({ ...baseEnv, OPENAI_REALTIME_SPEED: "fast" })).toBe(1.02);
  });

  it("extracts the call id from supported incoming webhook shapes", () => {
    expect(extractOpenAIRealtimeCallId({ data: { call_id: "call_123" } })).toBe("call_123");
    expect(extractOpenAIRealtimeCallId({ data: { call: { id: "call_456" } } })).toBe("call_456");
  });

  it("extracts caller phone from direct fields and SIP headers", () => {
    expect(extractOpenAIRealtimeCallerPhone({ data: { caller_id: "(415) 555-0123" } })).toBe("+14155550123");
    expect(
      extractOpenAIRealtimeCallerPhone({
        data: {
          sip_headers: [
            {
              name: "From",
              value: "\"Tim\" <sip:+14155550124@twilio.com>",
            },
          ],
        },
      }),
    ).toBe("+14155550124");
  });

  it("extracts provider call ids and transcript turns from realtime events", () => {
    const event = {
      data: {
        sip_headers: [
          { name: "X-Twilio-CallSid", value: "CA123" },
          { name: "Call-ID", value: "sip-call-123" },
        ],
      },
    };

    expect(extractOpenAIRealtimeExternalCallId(event)).toBe("CA123");
    expect(extractOpenAIRealtimeSipCallId(event)).toBe("sip-call-123");
    expect(
      extractOpenAIRealtimeTranscriptTurn({
        item_id: "item_caller",
        transcript: "Do you have any specials tonight?",
        type: "conversation.item.input_audio_transcription.completed",
      }),
    ).toEqual({
      itemId: "item_caller",
      role: "caller",
      text: "Do you have any specials tonight?",
    });
    expect(
      extractOpenAIRealtimeTranscriptTurn({
        item_id: "item_agent",
        transcript: "Tonight's specials are branzino and mushroom risotto.",
        type: "response.output_audio_transcript.done",
      }),
    ).toMatchObject({
      role: "agent",
      text: "Tonight's specials are branzino and mushroom risotto.",
    });
  });


  it("extracts completed realtime tool calls", () => {
    const toolCalls = extractOpenAIRealtimeToolCalls({
      response: {
        output: [
          {
            arguments: "{\"topic\":\"specials\"}",
            call_id: "call_tool_1",
            name: "lookup_restaurant_context",
            type: "function_call",
          },
        ],
      },
      type: "response.done",
    });

    expect(toolCalls).toEqual([
      {
        arguments: { topic: "specials" },
        callId: "call_tool_1",
        name: "lookup_restaurant_context",
      },
    ]);
  });

  it("returns menu and specials context for realtime lookup calls", () => {
    const result = lookupRestaurantContext(demoRestaurantContext, "specials");

    expect(JSON.stringify(result)).toContain("specials");
    expect(JSON.stringify(result)).toContain("Margherita pizza");
    expect(JSON.stringify(result)).toContain("substitutions");
  });

  it("records staff callback requests instead of pretending to transfer live calls", async () => {
    const alerts: unknown[] = [];
    const result = await requestOpenAIRealtimeStaffCallback({
      callRecordId: "call_uuid",
      callerPhone: "+14155550123",
      context: demoRestaurantContext,
      locationId: "location_uuid",
      rawArguments: {
        caller_name: "Tim",
        kind: "allergy",
        question: "My son has a severe peanut allergy. Can you accommodate that?",
        reason: "Severe peanut allergy needs staff confirmation.",
        urgency: "high",
      },
      staffNotificationService: {
        configured: true,
        async sendStaffAlert(input) {
          alerts.push(input);
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      status: "callback_requested",
    });
    expect(JSON.stringify(result)).toContain("do not say you are transferring");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      callId: "call_uuid",
      callerPhone: "+14155550123",
      kind: "low_confidence",
      locationId: "location_uuid",
      severity: "high",
    });
  });

  it("lets demo calls treat guest texts as sent when SMS is not configured", async () => {
    const result = await sendOpenAIRealtimeGuestConfirmation({
      callerPhone: "+14155550123",
      context: demoRestaurantContext,
      rawArguments: {
        kind: "note",
        message: "Your reservation request was received.",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      message: "Text confirmation sent.",
      phoneNumber: "+14155550123",
      sentToLastFour: "0123",
    });
  });

  it("creates staff-confirmed reservation requests from realtime tool calls", async () => {
    const savedReservations: unknown[] = [];
    const result = await createOpenAIRealtimeReservationRequest({
      callRecordId: "call_uuid",
      callerPhone: "+14155550123",
      context: demoRestaurantContext,
      locationId: "location_uuid",
      rawArguments: {
        guest_name: "Tim Schneider",
        notes: "Birthday",
        party_size: 4,
        reservation_date: "2026-05-12",
        reservation_time: "6 PM",
      },
      callStore: {
        async addTranscriptTurn() {},
        async attachCallRecording() {},
        async completeCall() {},
        async createStaffReviewOrder() {
          return {};
        },
        async createStaffReviewReservation(input) {
          savedReservations.push(input);
          return { reservationId: "res_uuid" };
        },
        async createStaffTask() {
          return {};
        },
        async startCall() {
          return {};
        },
        async startRealtimeCall() {
          return {};
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      confirmationMode: "staff_confirmed",
      reservationId: "res_uuid",
      status: "pending_staff_confirmation",
    });
    expect(savedReservations[0]).toMatchObject({
      callId: "call_uuid",
      callerPhone: "+14155550123",
      date: "2026-05-12",
      guestName: "Tim Schneider",
      partySize: 4,
      provider: "manual_request",
      time: "18:00",
    });
  });

  it("verifies OpenAI webhook signatures when a secret is configured", () => {
    const secretBytes = Buffer.from("secret");
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const rawBody = "{\"type\":\"realtime.call.incoming\"}";
    const timestamp = "1770000000";
    const webhookId = "wh_test";
    const signature = createHmac("sha256", secretBytes)
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest("base64");

    expect(
      verifyOpenAIWebhookSignature({
        headers: {
          "webhook-id": webhookId,
          "webhook-signature": `v1,${signature}`,
          "webhook-timestamp": timestamp,
        },
        nowSeconds: Number(timestamp),
        rawBody,
        secret,
      }),
    ).toBe(true);
  });
});

function createFakeRealtimeSocket() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    close() {},
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      const current = listeners.get(event) ?? [];
      current.push(listener);
      listeners.set(event, current);
      return this;
    },
    send() {},
  };
}
