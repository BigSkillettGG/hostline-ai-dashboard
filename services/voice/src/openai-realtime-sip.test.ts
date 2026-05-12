import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { VoiceServiceEnv } from "./env";
import {
  buildOpenAIRealtimeAcceptPayload,
  buildOpenAIRealtimeInstructions,
  buildOpenAIRealtimeLiveCallConfig,
  buildOpeningGreetingInstructions,
  buildOpenAIRealtimePreflight,
  buildRestaurantLocalTimeContext,
  buildShortOpeningGreeting,
  createOpenAIRealtimeCustomerRequest,
  createOpenAIRealtimeReservationRequest,
  createOpenAIRealtimeSipService,
  extractOpenAIRealtimeCallId,
  extractOpenAIRealtimeCallerPhone,
  extractOpenAIRealtimeExternalCallId,
  extractOpenAIRealtimeSipCallId,
  extractOpenAIRealtimeTranscriptTurn,
  extractOpenAIRealtimeToolCalls,
  finishOpenAIRealtimeCall,
  lookupRestaurantContext,
  requestOpenAIRealtimeStaffCallback,
  resolveOpenAIRealtimeIdleTimeoutMs,
  resolveOpenAIRealtimeInterruptResponse,
  resolveOpenAIRealtimeNoiseReduction,
  resolveOpenAIRealtimeServerVadPrefixPaddingMs,
  resolveOpenAIRealtimeServerVadSilenceMs,
  resolveOpenAIRealtimeServerVadThreshold,
  resolveOpenAIRealtimeSpeed,
  resolveOpenAIRealtimeTurnDetection,
  sendOpenAIRealtimeBusinessLink,
  sendOpenAIRealtimeGuestConfirmation,
  verifyOpenAIWebhookSignature,
} from "./openai-realtime-sip";
import { demoRestaurantContext, type RestaurantVoiceContext } from "./restaurant-context";

const baseEnv = {
  OPENAI_API_KEY: "sk-test",
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

  it("configures server VAD, restaurant instructions, and realtime tools", () => {
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
      idle_timeout_ms: 9000,
      interrupt_response: false,
      prefix_padding_ms: 250,
      silence_duration_ms: 550,
      threshold: 0.72,
      type: "server_vad",
    });
    expect(payload.audio.input.noise_reduction).toMatchObject({ type: "far_field" });
    expect(payload.audio.output.voice).toBe("marin");
    expect(payload.audio.output.speed).toBe(1.02);
    expect(payload.instructions).toContain("Never restart the opening greeting");
    expect(payload.instructions).toContain("Hi, thank you for calling Olive and Ember. How can I help you?");
    expect(payload.instructions).toContain("do not say you are virtual or AI");
    expect(payload.instructions).toContain("Avoid IVR cadence");
    expect(payload.instructions).toContain("polished restaurant host");
    expect(payload.instructions).toContain("Voice color");
    expect(payload.instructions).toContain("Make answers feel specific to what the caller just said");
    expect(payload.instructions).toContain("Use 'we' when speaking for the restaurant");
    expect(payload.instructions).toContain("There is no live staff transfer");
    expect(payload.instructions).toContain("substitutions or off-menu requests");
    expect(payload.instructions).toContain("Configured business links");
    expect(payload.instructions).toContain("Order operating mode");
    expect(payload.instructions).toContain("create_reservation_request");
    expect(payload.instructions).toContain("Speakerphone and car audio behavior");
    expect(payload.instructions).toContain("Can I help you with anything else?");
    expect(payload.instructions).toContain("finish_call");
    expect(payload.tools[0].name).toBe("lookup_restaurant_context");
    expect(payload.tools.map((tool) => tool.name)).toContain("send_guest_confirmation");
    expect(payload.tools.map((tool) => tool.name)).toContain("send_business_link");
    expect(payload.tools.map((tool) => tool.name)).toContain("create_customer_request");
    expect(payload.tools.map((tool) => tool.name)).toContain("create_reservation_request");
    expect(payload.tools.map((tool) => tool.name)).toContain("request_staff_callback");
    expect(payload.tools.map((tool) => tool.name)).toContain("finish_call");
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
          async createCustomerRequest() {
            return {};
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
    expect(instructions).toContain("Handle clear interruptions gracefully");
    expect(instructions).toContain("Speakerphone and car audio behavior");
    expect(instructions).toContain("Can I help you with anything else?");
    expect(instructions).toContain("Thanks for calling. Goodbye.");
    expect(instructions).toContain("Do not call finish_call until");
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

  it("uses server VAD speakerphone-safe turn detection by default", () => {
    expect(resolveOpenAIRealtimeNoiseReduction(baseEnv)).toBe("far_field");
    expect(resolveOpenAIRealtimeInterruptResponse(baseEnv)).toBe(false);
    expect(resolveOpenAIRealtimeServerVadThreshold(baseEnv)).toBe(0.72);
    expect(resolveOpenAIRealtimeServerVadSilenceMs(baseEnv)).toBe(550);
    expect(resolveOpenAIRealtimeServerVadPrefixPaddingMs(baseEnv)).toBe(250);
    expect(resolveOpenAIRealtimeIdleTimeoutMs(baseEnv)).toBe(9000);
    expect(resolveOpenAIRealtimeTurnDetection(baseEnv)).toMatchObject({
      interrupt_response: false,
      threshold: 0.72,
      type: "server_vad",
    });
    expect(
      buildOpenAIRealtimeAcceptPayload({
        context: demoRestaurantContext,
        env: {
          ...baseEnv,
          OPENAI_REALTIME_INTERRUPT_RESPONSE: true,
          OPENAI_REALTIME_NOISE_REDUCTION: "near_field",
          OPENAI_REALTIME_TURN_DETECTION_MODE: "semantic_vad",
          OPENAI_REALTIME_TURN_EAGERNESS: "high",
        },
      }).audio.input.turn_detection,
    ).toMatchObject({
      eagerness: "high",
      interrupt_response: true,
      type: "semantic_vad",
    });
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

  it("prepares a bounded closing line for finished calls", () => {
    expect(
      finishOpenAIRealtimeCall({
        rawArguments: {
          closing_line: "Thanks for calling Olive and Ember. Goodbye?",
          reason: "caller_done",
        },
      }),
    ).toMatchObject({
      action: "finish_call",
      closingLine: "Thanks for calling Olive and Ember. Goodbye.",
      ok: true,
    });
  });

  it("closes the realtime socket after the finish-call goodbye response completes", async () => {
    vi.useFakeTimers();
    try {
      const socket = createFakeRealtimeSocket();
      const service = createOpenAIRealtimeSipService(
        baseEnv,
        {
          async getContext() {
            return demoRestaurantContext;
          },
        },
        {
          fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
          websocketFactory: () => socket as never,
        },
      );

      await service.handleIncomingWebhook({
        headers: {},
        rawBody: JSON.stringify({
          data: {
            call_id: "rtc_finish",
            sip_headers: [{ name: "From", value: "sip:+17813072672@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          response: {
            output: [
              {
                arguments: "{\"reason\":\"caller_done\",\"closing_line\":\"Thanks for calling. Goodbye.\"}",
                call_id: "call_finish",
                name: "finish_call",
                type: "function_call",
              },
            ],
          },
          type: "response.done",
        })),
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(socket.closeCalls).toHaveLength(0);

      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          response: { output: [] },
          type: "response.done",
        })),
      );
      await vi.advanceTimersByTimeAsync(300);

      expect(socket.closeCalls[0]).toMatchObject({
        code: 1000,
        reason: "HostLine call completed.",
      });
    } finally {
      vi.useRealTimers();
    }
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

  it("texts configured business links from realtime tool calls", async () => {
    const sentMessages: unknown[] = [];
    const result = await sendOpenAIRealtimeBusinessLink({
      callerPhone: "+14155550123",
      context: demoRestaurantContext,
      guestConfirmationService: {
        configured: true,
        async sendOrderConfirmation() {},
        async sendReservationConfirmation() {},
        async sendTextMessage(input) {
          sentMessages.push(input);
        },
      },
      rawArguments: {
        link_kind: "ordering",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      sentToLastFour: "0123",
    });
    expect(sentMessages[0]).toMatchObject({
      message: expect.stringContaining("https://oliveandember.example/order"),
      to: "+14155550123",
    });
  });

  it("creates generic customer requests for cross-industry workflows", async () => {
    const requests: unknown[] = [];
    const result = await createOpenAIRealtimeCustomerRequest({
      callRecordId: "call_uuid",
      callerPhone: "+14155550123",
      context: demoRestaurantContext,
      locationId: "location_uuid",
      rawArguments: {
        caller_name: "Sam",
        details: { issue: "water heater leaking", service_area: "Newton" },
        request_type: "service appointment",
        summary: "Sam needs help with a leaking water heater in Newton.",
        urgency: "high",
      },
      callStore: {
        async addTranscriptTurn() {},
        async attachCallRecording() {},
        async completeCall() {},
        async createCustomerRequest(input) {
          requests.push(input);
          return { requestId: "request_uuid", taskId: "task_uuid" };
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
        async startRealtimeCall() {
          return {};
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      requestId: "request_uuid",
      requestType: "service_appointment",
      taskId: "task_uuid",
    });
    expect(requests[0]).toMatchObject({
      customerName: "Sam",
      customerPhone: "+14155550123",
      priority: "high",
      requestType: "service_appointment",
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
        async createCustomerRequest() {
          return {};
        },
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

  it("persists confirmed OpenTable reservations from realtime tool calls", async () => {
    const savedReservations: unknown[] = [];
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      reservationSettings: {
        ...demoRestaurantContext.reservationSettings,
        handlingMode: "integration",
        provider: "opentable",
      },
    };
    const result = await createOpenAIRealtimeReservationRequest({
      callRecordId: "call_uuid",
      callerPhone: "+14155550123",
      context,
      locationId: "location_uuid",
      rawArguments: {
        guest_name: "Tim Schneider",
        party_size: 4,
        reservation_date: "2026-05-12",
        reservation_time: "18:00",
      },
      reservationPlatformService: {
        configured: true,
        provider: "opentable",
        async createReservation() {
          return {
            confirmationCode: "OT-123",
            ok: true,
            message: "Confirmed.",
            provider: "opentable",
            providerReservationId: "ot_res_123",
            status: "confirmed",
          };
        },
      },
      callStore: {
        async addTranscriptTurn() {},
        async attachCallRecording() {},
        async completeCall() {},
        async createCustomerRequest() {
          return {};
        },
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
      confirmationCode: "OT-123",
      confirmationMode: "provider_confirmed",
      provider: "opentable",
      providerReservationId: "ot_res_123",
      reservationId: "res_uuid",
      status: "confirmed",
    });
    expect(savedReservations[0]).toMatchObject({
      manualRequest: false,
      provider: "opentable",
      providerReservationId: "ot_res_123",
      status: "confirmed",
    });
  });

  it("returns a booking-link response when reservations are link-only", async () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      reservationSettings: {
        ...demoRestaurantContext.reservationSettings,
        bookingUrl: "https://www.opentable.com/r/olive-and-ember",
        handlingMode: "booking_link",
      },
    };

    const result = await createOpenAIRealtimeReservationRequest({
      context,
      rawArguments: {
        guest_name: "Avery Chen",
        party_size: 2,
        reservation_date: "2026-05-12",
        reservation_time: "7 PM",
      },
    });

    expect(result).toMatchObject({
      bookingUrl: "https://www.opentable.com/r/olive-and-ember",
      confirmationMode: "booking_link",
      ok: true,
      status: "booking_link_required",
    });
  });

  it("can auto-confirm HostLine Lite reservations within configured rules", async () => {
    const savedReservations: unknown[] = [];
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      reservationSettings: {
        ...demoRestaurantContext.reservationSettings,
        autoConfirmPartyLimit: 4,
        handlingMode: "hostline_lite_confirm",
        provider: "none",
      },
    };

    const result = await createOpenAIRealtimeReservationRequest({
      callRecordId: "call_uuid",
      callerPhone: "+14155550123",
      context,
      locationId: "location_uuid",
      rawArguments: {
        guest_name: "Avery Chen",
        party_size: 4,
        reservation_date: "2026-05-12",
        reservation_time: "7 PM",
      },
      callStore: {
        async addTranscriptTurn() {},
        async attachCallRecording() {},
        async completeCall() {},
        async createCustomerRequest() {
          return {};
        },
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
      confirmationMode: "hostline_lite_confirmed",
      ok: true,
      provider: "hostline_lite",
      status: "confirmed",
    });
    expect(savedReservations[0]).toMatchObject({
      manualRequest: false,
      provider: "hostline_lite",
      status: "confirmed",
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
    closeCalls: [] as Array<{ code?: number; reason?: string }>,
    sentEvents: [] as unknown[],
    close(code?: number, reason?: Buffer | string) {
      const reasonText = Buffer.isBuffer(reason) ? reason.toString("utf8") : String(reason ?? "");
      this.closeCalls.push({ code, reason: reasonText });
      this.emit("close", code ?? 1000, Buffer.from(reasonText));
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      const current = listeners.get(event) ?? [];
      current.push(listener);
      listeners.set(event, current);
      return this;
    },
    send(data: string) {
      try {
        this.sentEvents.push(JSON.parse(data) as unknown);
      } catch {
        this.sentEvents.push(data);
      }
    },
  };
}
