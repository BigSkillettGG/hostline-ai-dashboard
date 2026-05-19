import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { VoiceServiceEnv } from "./env";
import {
  buildOpenAIRealtimeAcceptPayload,
  buildOpenAIRealtimeInstructions,
  buildOpenAIRealtimeLiveCallConfig,
  buildOwnerOpeningGreeting,
  buildOwnerRealtimeInstructions,
  buildOpeningGreetingInstructions,
  buildOpenAIRealtimePreflight,
  buildRestaurantLocalTimeContext,
  buildShortOpeningGreeting,
  createOpenAIRealtimeCustomerRequest,
  createOpenAIRealtimeReservationRequest,
  createOpenAIRealtimeSipService,
  extractOpenAIRealtimeCallId,
  extractOpenAIRealtimeCallerPhone,
  extractOpenAIRealtimeDestinationPhone,
  extractOpenAIRealtimeExternalCallId,
  extractOpenAIRealtimeSipCallId,
  extractOpenAIRealtimeTranscriptTurn,
  extractOpenAIRealtimeToolCalls,
  findTrustedOwnerCaller,
  finishOpenAIRealtimeCall,
  lookupBusinessContext,
  lookupRestaurantContext,
  normalizeOpenAIRealtimeCustomerAddress,
  requestOpenAIRealtimeStaffCallback,
  resolveOpenAIRealtimeAcceptProvider,
  resolveOpenAIRealtimeGreetingDelayMs,
  resolveOpenAIRealtimeIdleTimeoutMs,
  resolveOpenAIRealtimeInterruptResponse,
  resolveOpenAIRealtimeManualResponseGating,
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
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 12000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_DETAIL_CAPTURE_RESPONSE_DELAY_MS: 0,
  OPENAI_REALTIME_GREETING_DELAY_MS: 0,
  OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS: 0,
  OPENAI_REALTIME_MANUAL_RESPONSE_GATING: true,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 150,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 900,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.88,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "semantic_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai/",
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
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
      model: "gpt-realtime-2",
      noiseReduction: "far_field",
      projectIdConfigured: true,
      ready: true,
      recordingStatusCallbackUrl: "https://voice.signalhost.ai/twilio/recording-status",
      sipUri: "sip:proj_123@sip.api.openai.com;transport=tls",
      speed: 1.02,
      turnDetection: {
        create_response: false,
        eagerness: "low",
        interrupt_response: false,
        type: "semantic_vad",
      },
      voice: "marin",
      webhookSecretConfigured: false,
      webhookUrl: "https://voice.signalhost.ai/openai/realtime/webhook?locationId=loc_123",
    });
  });

  it("configures semantic VAD, restaurant instructions, and realtime tools", () => {
    const payload = buildOpenAIRealtimeAcceptPayload({
      context: demoRestaurantContext,
      env: baseEnv,
    });

    expect(payload).toMatchObject({
      model: "gpt-realtime-2",
      output_modalities: ["audio"],
      tool_choice: "auto",
      type: "realtime",
    });
    expect(payload.audio.input.turn_detection).toMatchObject({
      create_response: false,
      eagerness: "low",
      interrupt_response: false,
      type: "semantic_vad",
    });
    expect(payload.audio.input.turn_detection).not.toHaveProperty("idle_timeout_ms");
    expect(payload.audio.input.turn_detection).not.toHaveProperty("threshold");
    expect(payload.audio.input.turn_detection).not.toHaveProperty("prefix_padding_ms");
    expect(payload.audio.input.turn_detection).not.toHaveProperty("silence_duration_ms");
    expect(payload.audio.input.noise_reduction).toMatchObject({ type: "far_field" });
    expect(payload.audio.output.voice).toBe("marin");
    expect(payload.audio.output.speed).toBe(1.02);
    expect(payload.instructions).toContain("Never restart the opening greeting");
    expect(payload.instructions).toContain("Thank you for calling Olive and Ember. How can I help you?");
    expect(payload.instructions).toContain("if the caller asks whether they reached Olive & Ember");
    expect(payload.instructions).toContain("Never answer no");
    expect(payload.instructions).toContain("Do not say you are virtual or AI");
    expect(payload.instructions).toContain("Avoid IVR cadence");
    expect(payload.instructions).toContain("excellent restaurant host");
    expect(payload.instructions).toContain("Voice color");
    expect(payload.instructions).toContain("Make answers feel specific to what the caller just said");
    expect(payload.instructions).toContain("Use 'we' when speaking for the restaurant");
    expect(payload.instructions).toContain("There is no live staff transfer");
    expect(payload.instructions).toContain("substitutions or off-menu requests");
    expect(payload.instructions).toContain("Configured business links");
    expect(payload.instructions).toContain("Order operating mode");
    expect(payload.instructions).toContain("Margherita Pizza $18.00");
    expect(payload.instructions).toContain("For direct menu availability or orderability questions");
    expect(payload.instructions).toContain("Universal intake style");
    expect(payload.instructions).toContain("ask one short question at a time");
    expect(payload.instructions).toContain("Address capture");
    expect(payload.instructions).toContain("normalize_customer_address");
    expect(payload.instructions).toContain("Do not infer urgency");
    expect(payload.instructions).toContain("Incomplete speech guardrail");
    expect(payload.instructions).toContain("do not infer the missing words");
    expect(payload.instructions).toContain("create_reservation_request");
    expect(payload.instructions).toContain("Noisy-room behavior");
    expect(payload.instructions).toContain("Echo guardrail");
    expect(payload.instructions).toContain("Can I help you with anything else?");
    expect(payload.instructions).toContain("finish_call");
    expect(payload.tools[0].name).toBe("lookup_restaurant_context");
    expect(payload.tools.map((tool) => tool.name)).toContain("send_guest_confirmation");
    expect(payload.tools.map((tool) => tool.name)).toContain("send_business_link");
    expect(payload.tools.map((tool) => tool.name)).toContain("normalize_customer_address");
    expect(payload.tools.map((tool) => tool.name)).toContain("create_customer_request");
    expect(payload.tools.map((tool) => tool.name)).toContain("create_reservation_request");
    expect(payload.tools.map((tool) => tool.name)).toContain("request_staff_callback");
    expect(payload.tools.map((tool) => tool.name)).toContain("finish_call");
  });

  it("routes only the Harbor Plumbing demo location through the Agents SDK SIP accept payload by default", () => {
    expect(resolveOpenAIRealtimeAcceptProvider(baseEnv, "22222222-2222-4222-8222-222222222222")).toBe("agents_sdk");
    expect(resolveOpenAIRealtimeAcceptProvider(baseEnv, "78d8053b-631d-4811-939f-61f0efe1d82a")).toBe("custom");
    expect(resolveOpenAIRealtimeAcceptProvider({ ...baseEnv, OPENAI_REALTIME_PROVIDER: "custom" }, "22222222-2222-4222-8222-222222222222")).toBe("custom");
    expect(resolveOpenAIRealtimeAcceptProvider({ ...baseEnv, OPENAI_REALTIME_PROVIDER: "agents_sdk" }, "78d8053b-631d-4811-939f-61f0efe1d82a")).toBe("agents_sdk");
  });

  it("configures realtime payloads for service businesses without restaurant tooling", () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "hvac",
      restaurantName: "Summit Air",
      menuHighlights: ["No heat", "No AC", "Tune-ups", "Replacement estimates"],
      reservationSettings: {
        ...demoRestaurantContext.reservationSettings,
        bookingUrl: "https://summit.example/book",
        handlingMode: "booking_link",
        provider: "ServiceTitan",
        sourceToday: "ServiceTitan",
      },
      orderSettings: {
        enabled: true,
        handlingMode: "staff_review",
      },
      policies: {
        ...demoRestaurantContext.policies,
        hours: "Mon-Fri 8 AM to 6 PM, emergency callbacks after hours.",
        menu: "Service catalog: no heat, no AC, tune-ups, indoor air quality, and replacement estimates.",
        reservations: "Booking requests go to dispatch for confirmation.",
      },
    };

    const payload = buildOpenAIRealtimeAcceptPayload({
      context,
      env: baseEnv,
    });

    expect(payload.audio.input.transcription.prompt).toContain("Transcription vocabulary hints for Summit Air (HVAC company)");
    expect(payload.audio.input.transcription.prompt).toContain("no heat");
    expect(payload.instructions).toContain("Business profile: HVAC company");
    expect(payload.instructions).toContain("if the caller asks whether they reached Summit Air");
    expect(payload.instructions).toContain("answer yes");
    expect(payload.instructions).toContain("dispatcher");
    expect(payload.instructions).toContain("service catalog");
    expect(payload.instructions).toContain("Service-request operating mode");
    expect(payload.instructions).toContain("use create_customer_request");
    expect(payload.instructions).toContain("Service-problem boundary");
    expect(payload.instructions).toContain("your job is to create a strong lead for staff");
    expect(payload.instructions).toContain("Do not walk callers through troubleshooting");
    expect(payload.instructions).toContain("text a copy of the request details");
    expect(payload.instructions).toContain("Do not call it a confirmation unless a real appointment is confirmed");
    expect(payload.instructions).toContain("Universal intake style");
    expect(payload.instructions).toContain("ask one short question at a time");
    expect(payload.instructions).toContain("Do not infer urgency");
    expect(payload.instructions).toContain("ambiguous or partial answer");
    expect(payload.instructions).toContain("I have a leak in my...");
    expect(payload.instructions).toContain("instead of assuming kitchen");
    expect(payload.instructions).not.toContain("Plumbing urgency guardrail");
    expect(payload.instructions).not.toContain("HVAC urgency guardrail");
    expect(payload.instructions).not.toContain("Electrical urgency guardrail");
    expect(payload.instructions).not.toContain("Roofing urgency guardrail");
    expect(payload.instructions).not.toContain("use create_reservation_request to save the request");
    expect(payload.tools[0].name).toBe("lookup_business_context");
    expect(payload.tools.map((tool) => tool.name)).not.toContain("create_reservation_request");
    expect(payload.tools.map((tool) => tool.name)).toContain("create_customer_request");
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

  it("switches trusted owner callers into internal owner-assistant mode", () => {
    const ownerContact = demoRestaurantContext.trustedContacts[0];
    const payload = buildOpenAIRealtimeAcceptPayload({
      callerPhone: ownerContact.phone,
      context: demoRestaurantContext,
      env: baseEnv,
      ownerContact,
    });

    expect(findTrustedOwnerCaller(demoRestaurantContext, "(415) 555-0148")).toMatchObject({
      contactType: "owner",
      name: "Maria",
    });
    expect(payload.instructions).toContain("internal owner-assistant call");
    expect(payload.instructions).toContain("run_owner_command");
    expect(payload.instructions).not.toContain("Thank you for calling Olive and Ember. How can I help you?");
    expect(payload.tools.map((tool) => tool.name)).toEqual(["run_owner_command", "finish_call"]);
    expect(buildOwnerRealtimeInstructions(demoRestaurantContext, ownerContact)).toContain("trusted owner");
    expect(buildOwnerOpeningGreeting(ownerContact)).toBe("Hi Maria, it's SignalHost. What would you like to check or update?");
    expect(buildOpeningGreetingInstructions(demoRestaurantContext, ownerContact)).toContain("internal owner greeting");
  });

  it("formats restaurant-local time in the restaurant timezone", () => {
    expect(buildRestaurantLocalTimeContext(demoRestaurantContext, new Date("2026-05-12T01:30:00.000Z"))).toContain(
      "Monday, May 11, 2026",
    );
  });

  it("preflights the realtime model and restaurant context before SIP testing", async () => {
    const fetchMock = async () => new Response(JSON.stringify({ id: "gpt-realtime-2" }), { status: 200 });
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
    expect(preflight.config.webhookUrl).toBe("https://voice.signalhost.ai/openai/realtime/webhook?locationId=loc_123");
    expect(preflight.checks.find((check) => check.id === "openai_realtime_model")).toMatchObject({ ready: true });
    expect(preflight.restaurantName).toBe("Olive & Ember");
  });

  it("starts and completes a persisted call for incoming SIP webhooks", async () => {
    const socket = createFakeRealtimeSocket();
    const recordingAttachments: unknown[] = [];
    const recordingRequests: unknown[] = [];
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
        callRecordingService: {
          callbackUrl: "https://voice.signalhost.ai/twilio/recording-status",
          configured: true,
          async findCompletedCallRecording() {
            return {};
          },
          async startCallRecording(input) {
            recordingRequests.push(input);
            return {
              recordingSid: "RE123",
              recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123.mp3",
              started: true,
            };
          },
        },
        callStore: {
          async addTranscriptTurn(input) {
            transcriptTurns.push(input);
          },
          async attachCallRecording(input) {
            recordingAttachments.push(input);
          },
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
    expect(recordingRequests[0]).toMatchObject({
      callRecordId: "call_uuid",
      externalCallSid: "CA123",
      locationId: "00000000-0000-0000-0000-000000000001",
      openaiCallId: "rtc_123",
    });
    await Promise.resolve();
    expect(recordingAttachments[0]).toMatchObject({
      callId: "call_uuid",
      externalCallSid: "CA123",
      recordingSid: "RE123",
      recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123.mp3",
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "item_1",
        transcript: "What time do you close tonight?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "prompt_leak",
        transcript:
          "Hi, this is a phone call with Olive & Ember, a restaurant. Expect restaurant words: reservations, pickup orders, specials, menu, happy hour, parking, allergies, delivery drivers, hours, waitlist, private events. Menu terms include: Neighborhood Italian restaurant with wood-fired pizza, handmade pasta, seasonal cocktails, and weekend brunch.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();
    expect(transcriptTurns[0]).toMatchObject({
      callId: "call_uuid",
      speaker: "caller",
      text: "What time do you close tonight?",
    });
    expect(transcriptTurns).toHaveLength(1);

    socket.emit("close", 1000, Buffer.from("normal"));
    await Promise.resolve();
    await Promise.resolve();
    expect(completedCalls[0]).toMatchObject({
      callId: "call_uuid",
      intent: "hours",
      status: "resolved",
    });
  });

  it("delays the opening greeting so callers hear the full business greeting", async () => {
    vi.useFakeTimers();
    try {
      const socket = createFakeRealtimeSocket();
      const service = createOpenAIRealtimeSipService(
        {
          ...baseEnv,
          OPENAI_REALTIME_GREETING_DELAY_MS: 900,
          TWILIO_CALL_RECORDING_ENABLED: "false",
        },
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
            call_id: "rtc_delayed_greeting",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          id: "evt_delayed_greeting",
          object: "event",
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(899);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs a full reservation call lifecycle through SIP, tools, SMS, and completion", async () => {
    const socket = createFakeRealtimeSocket();
    const startedCalls: unknown[] = [];
    const transcriptTurns: unknown[] = [];
    const savedReservations: unknown[] = [];
    const sentReservationTexts: unknown[] = [];
    const completedCalls: unknown[] = [];
    const service = createOpenAIRealtimeSipService(
      {
        ...baseEnv,
        TWILIO_CALL_RECORDING_ENABLED: "false",
      },
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
          async startRealtimeCall(input) {
            startedCalls.push(input);
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        guestConfirmationService: {
          configured: true,
          async sendOrderConfirmation() {},
          async sendReservationConfirmation(input) {
            sentReservationTexts.push(input);
          },
          async sendTextMessage() {},
        },
        websocketFactory: () => socket as never,
      },
    );

    const result = await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_lifecycle",
          sip_headers: [
            { name: "X-Twilio-CallSid", value: "CA555" },
            { name: "Call-ID", value: "sip-lifecycle" },
            { name: "From", value: "sip:+14155550123@twilio.com" },
          ],
        },
        id: "evt_lifecycle",
        object: "event",
        type: "realtime.call.incoming",
      }),
    });

    expect(result.status).toBe(200);
    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_reservation",
        transcript: "Can I make a reservation for four tonight at seven under Priya Shah?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: {
          output: [
            {
              arguments: JSON.stringify({
                guest_name: "Priya Shah",
                party_size: 4,
                reservation_date: "2026-05-15",
                reservation_time: "19:00",
              }),
              call_id: "tool_reservation",
              name: "create_reservation_request",
              type: "function_call",
            },
            {
              arguments: JSON.stringify({
                guest_name: "Priya Shah",
                kind: "reservation",
                party_size: 4,
                phone_number: "+14155550123",
                reservation_date: "2026-05-15",
                reservation_time: "19:00",
              }),
              call_id: "tool_text",
              name: "send_guest_confirmation",
              type: "function_call",
            },
          ],
        },
        type: "response.done",
      })),
    );
    await flushAsyncWork();

    expect(startedCalls[0]).toMatchObject({
      callerPhone: "+14155550123",
      externalCallId: "CA555",
      externalSessionId: "sip-lifecycle",
    });
    expect(transcriptTurns[0]).toMatchObject({
      callId: "call_uuid",
      speaker: "caller",
      text: "Can I make a reservation for four tonight at seven under Priya Shah?",
    });
    expect(savedReservations[0]).toMatchObject({
      callId: "call_uuid",
      callerPhone: "+14155550123",
      guestName: "Priya Shah",
      locationId: "00000000-0000-0000-0000-000000000001",
      partySize: 4,
      time: "19:00",
    });
    expect(sentReservationTexts[0]).toMatchObject({
      callId: "call_uuid",
      guestName: "Priya Shah",
      locationId: "00000000-0000-0000-0000-000000000001",
      partySize: 4,
      restaurantName: "Olive & Ember",
      to: "+14155550123",
    });
    expect(
      socket.sentEvents.filter((event) => isRealtimeEventType(event, "conversation.item.create")),
    ).toHaveLength(2);

    socket.emit("close", 1000, Buffer.from("normal"));
    await flushAsyncWork();
    expect(completedCalls[0]).toMatchObject({
      callId: "call_uuid",
      intent: "reservation",
      outcome: "message_taken",
      reservationId: "res_uuid",
      status: "new",
    });
  });

  it("does not mark a call needs-review when an optional text tool failure is recovered", async () => {
    const socket = createFakeRealtimeSocket();
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
          async addTranscriptTurn() {},
          async attachCallRecording() {},
          async completeCall(input) {
            completedCalls.push(input);
          },
          async createCustomerRequest() {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_recovered_text",
          sip_headers: [{ name: "Call-ID", value: "sip-recovered-text" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_service",
        transcript: "I need someone to look at a leaking water heater as soon as possible.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: {
          output: [
            {
              arguments: JSON.stringify({
                callback_phone: "+16034899218",
                request_type: "service_appointment",
                summary: "Caller needs help with a leaking water heater.",
              }),
              call_id: "tool_request",
              name: "create_customer_request",
              type: "function_call",
            },
            {
              arguments: JSON.stringify({
                kind: "appointment",
                message: "We received your plumbing service request.",
              }),
              call_id: "tool_text_missing_phone",
              name: "send_guest_confirmation",
              type: "function_call",
            },
            {
              arguments: JSON.stringify({
                kind: "appointment",
                message: "We received your plumbing service request.",
                phone_number: "+16034899218",
              }),
              call_id: "tool_text_success",
              name: "send_guest_confirmation",
              type: "function_call",
            },
          ],
        },
        type: "response.done",
      })),
    );
    await flushAsyncWork();

    socket.emit("close", 1000, Buffer.from("normal"));
    await flushAsyncWork();

    expect(completedCalls[0]).toMatchObject({
      callId: "call_uuid",
      intent: "faq",
      outcome: "message_taken",
      status: "new",
    });
    expect(String((completedCalls[0] as { summary?: string }).summary)).not.toContain("Quality flags: tool errors");
  });

  it("gates realtime responses so greeting echo and TV noise do not drive the call", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_noise",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { id: "resp_greeting" },
        type: "response.created",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "echo_1",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "tv_1",
        transcript: "Coming up next tonight after the break.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toHaveLength(0);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
  });

  it("ignores speakerphone courtesy echo right after the opening greeting", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_opening_backchannel",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_echo_thanks",
        transcript: "Thanks for calling.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual([
      expect.objectContaining({
        speaker: "agent",
        text: "Thank you for calling Olive and Ember. How can I help you?",
      }),
    ]);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
    expect(socket.sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: "caller_echo_thanks",
          type: "conversation.item.delete",
        }),
      ]),
    );
  });

  it("does not treat opening transcript completion as safe to accept greeting echo", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_greeting_transcript_echo",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { id: "resp_greeting" },
        type: "response.created",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_partial_greeting_echo",
        transcript: "Thanks for calling.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual([
      expect.objectContaining({
        speaker: "agent",
        text: "Thank you for calling Olive and Ember. How can I help you?",
      }),
    ]);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
    expect(socket.sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: "caller_partial_greeting_echo",
          type: "conversation.item.delete",
        }),
      ]),
    );
  });

  it("locks out all caller speech until the opening greeting audio completes", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_greeting_lock",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { id: "resp_greeting" },
        type: "response.created",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_talked_over_greeting",
        transcript: "I need emergency plumbing help.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual([
      expect.objectContaining({
        speaker: "agent",
      }),
    ]);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
    expect(socket.sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: "caller_talked_over_greeting",
          type: "conversation.item.delete",
        }),
      ]),
    );

    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_after_greeting",
        transcript: "I need emergency plumbing help.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    expect(transcriptTurns).toEqual([
      expect.objectContaining({ speaker: "agent" }),
      expect.objectContaining({
        speaker: "caller",
        text: "I need emergency plumbing help.",
      }),
    ]);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
  });

  it("disables realtime turn detection during the opening greeting and restores it after audio completion", async () => {
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
          call_id: "rtc_greeting_turn_detection",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    expect(socket.sentEvents[0]).toMatchObject({
      session: {
        audio: {
          input: {
            turn_detection: null,
          },
        },
      },
      type: "session.update",
    });

    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { id: "resp_greeting" },
        type: "response.created",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    expect(
      socket.sentEvents.filter(
        (event) =>
          isRealtimeEventType(event, "session.update") &&
          (event as { session?: { audio?: { input?: { turn_detection?: unknown } } } }).session?.audio?.input
            ?.turn_detection,
      ),
    ).toHaveLength(0);

    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.audio.done" })));
    expect(socket.sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          session: expect.objectContaining({
            audio: {
              input: {
                turn_detection: expect.objectContaining({
                  create_response: false,
                  eagerness: "low",
                  interrupt_response: false,
                  type: "semantic_vad",
                }),
              },
            },
          }),
          type: "session.update",
        }),
      ]),
    );
  });

  it("marks short greeting-only SIP calls for review instead of resolved", async () => {
    const socket = createFakeRealtimeSocket();
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
          async addTranscriptTurn() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_greeting_only",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("close", 1006, Buffer.from(""));
    await flushAsyncWork();

    expect(completedCalls[0]).toMatchObject({
      confidence: 20,
      intent: "other",
      outcome: "audio_unavailable",
      status: "needs_review",
    });
  });

  it("marks uncaptured non-restaurant service problems for review instead of resolved", async () => {
    const socket = createFakeRealtimeSocket();
    const completedCalls: unknown[] = [];
    const hvacContext: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "hvac",
      menuItems: [],
      restaurantName: "Summit Air",
    };
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return hvacContext;
        },
      },
      {
        callStore: {
          async addTranscriptTurn() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_uncaptured_hvac_problem",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Summit Air. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_ac_problem",
        transcript: "Yeah, our air conditioner is not cooling.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit("close", 1006, Buffer.from(""));
    await flushAsyncWork();

    expect(completedCalls[0]).toMatchObject({
      confidence: 72,
      intent: "reservation",
      outcome: "unknown",
      status: "needs_review",
    });
  });

  it("creates one gated response for a valid caller turn after the greeting completes", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_valid",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { output: [] },
        type: "response.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_1",
        transcript: "Do you have any specials tonight?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns[0]).toMatchObject({
      speaker: "caller",
      text: "Do you have any specials tonight?",
    });
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
  });

  it("ignores tiny stray transcript fragments that arrive after a clear service request", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
    const service = createOpenAIRealtimeSipService(
      {
        ...baseEnv,
        OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS: 1000,
      },
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_stray_fragment",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_service",
        transcript: "Sure, I want to get a leaky faucet checked.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_stray",
        transcript: "I'm fixed.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    expect(transcriptTurns).toEqual([
      expect.objectContaining({
        speaker: "caller",
        text: "Sure, I want to get a leaky faucet checked.",
      }),
    ]);
    expect(socket.sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: "caller_stray",
          type: "conversation.item.delete",
        }),
      ]),
    );
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
  });

  it("treats what as clarification instead of an answer to the previous question", async () => {
    const socket = createFakeRealtimeSocket();
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return demoRestaurantContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_clarification",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_service",
        transcript: "Sure, I want to get a leaky faucet checked.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_misheard",
        transcript: "Got it. So you've fixed the leaky faucet yourself. Is there anything else you'd like help with today?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_what",
        transcript: "What?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(responses.at(-1)).toMatchObject({
      response: {
        instructions: expect.stringContaining("last clear caller request"),
      },
    });
    expect(JSON.stringify(responses.at(-1))).toContain("leaky faucet checked");
    expect(JSON.stringify(responses.at(-1))).toContain("Do not restart");
  });

  it("keeps obvious cross-vertical requests from becoming normal appointments", async () => {
    const socket = createFakeRealtimeSocket();
    const hvacContext: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "hvac",
      menuItems: [],
      restaurantName: "Summit Air",
    };
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return hvacContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_cross_vertical",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_plumbing_request",
        transcript: "Sure, I want to get a leaky faucet checked.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(responses.at(-1)).toMatchObject({
      response: {
        instructions: expect.stringContaining("outside the usual scope for Summit Air"),
      },
    });
    expect(JSON.stringify(responses.at(-1))).toContain("no heat, no AC");
    expect(JSON.stringify(responses.at(-1))).toContain("Do not create or confirm an appointment");
  });

  it("keeps matching vertical service requests flexible and in scope", async () => {
    const socket = createFakeRealtimeSocket();
    const plumbingContext: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "plumbing",
      menuItems: [],
      restaurantName: "Harbor Plumbing",
    };
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return plumbingContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_matching_vertical",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_plumbing_request",
        transcript: "Sure, I want to get a leaky faucet checked.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(JSON.stringify(responses.at(-1))).not.toContain("outside the usual scope");
    expect(JSON.stringify(responses.at(-1))).toContain("qualified lead, not a troubleshooting session");
    expect(JSON.stringify(responses.at(-1))).toContain("Ask exactly one short intake question at a time");
  });

  it("keeps service-problem calls focused on lead capture instead of troubleshooting", async () => {
    const socket = createFakeRealtimeSocket();
    const hvacContext: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "hvac",
      menuItems: [],
      restaurantName: "Summit Air",
    };
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return hvacContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_hvac_not_cooling",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_hvac_problem",
        transcript: "Yeah, it's not cooling.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    const instructions = JSON.stringify(responses.at(-1));
    expect(instructions).toContain("qualified lead, not a troubleshooting session");
    expect(instructions).toContain("Do not diagnose");
    expect(instructions).toContain("Ask exactly one short intake question");
    expect(instructions).toContain("Do not end with an unfinished lead-in");
    expect(instructions).toContain("create_customer_request");
    expect(instructions).not.toContain("outside the usual scope");
  });

  it("answers a connection check after the greeting without restarting the greeting", async () => {
    const socket = createFakeRealtimeSocket();
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return demoRestaurantContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_connection_check",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.created" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_hello",
        transcript: "Hello?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(responses).toHaveLength(2);
    expect(responses.at(-1)).toMatchObject({
      response: {
        instructions: expect.stringContaining("I'm here. How can I help you?"),
      },
    });
    expect(JSON.stringify(responses.at(-1))).not.toContain("Thank you for calling");
  });

  it("keeps the last question when a caller says the audio cut out mid-call", async () => {
    const socket = createFakeRealtimeSocket();
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return demoRestaurantContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_mid_call_connection_check",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_initial",
        transcript: "I want to schedule an AC inspection.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_time_question",
        transcript: "What day and time window",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_connection_check",
        transcript: "We lost touch. I don't know what you want.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(JSON.stringify(responses.at(-1))).toContain("What day and time window");
    expect(JSON.stringify(responses.at(-1))).toContain("Do not restart the call");
    expect(JSON.stringify(responses.at(-1))).not.toContain("Thank you for calling");
  });

  it("does not repeat the service need after a service lead connection check", async () => {
    const socket = createFakeRealtimeSocket();
    const hvacContext: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "hvac",
      restaurantName: "Summit Air",
    };
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return hvacContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_service_connection_recovery",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_schedule",
        transcript: "I was calling to make an appointment.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_problem_question",
        transcript: "Sure. What would you like the appointment for?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_hvac_problem",
        transcript: "We have a leaky air conditioning unit that's not getting cold.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_broken_answer",
        transcript: "Got it, that's something we should get on the schedule. What",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_connection_check",
        transcript: "Hello?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    const instructions = JSON.stringify(responses.at(-1));
    expect(instructions).toContain("in-progress service lead");
    expect(instructions).toContain("air conditioning unit");
    expect(instructions).toContain("Ask what day or time they would prefer");
    expect(instructions).toContain("Do not ask what the appointment is for again");
  });

  it("accepts ASAP as enough timing detail for service businesses", async () => {
    const socket = createFakeRealtimeSocket();
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return {
            ...demoRestaurantContext,
            businessType: "hvac",
            restaurantName: "Summit Air",
          };
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_service_asap",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_initial",
        transcript: "I want to schedule an AC inspection as soon as possible.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_time_question",
        transcript: "What specific day and time works for you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_asap_repair",
        transcript: "I already said as soon as possible.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(JSON.stringify(responses.at(-1))).toContain("already gave a valid timing preference");
    expect(JSON.stringify(responses.at(-1))).toContain("Do not ask again for a specific date or time");
  });

  it("answers who-is-this questions with the business identity", async () => {
    const socket = createFakeRealtimeSocket();
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return demoRestaurantContext;
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_identity_question",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.created" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Olive and Ember. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_who",
        transcript: "Who is this?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(responses.at(-1)).toMatchObject({
      response: {
        instructions: expect.stringContaining("You've reached Olive and Ember."),
      },
    });
    expect(JSON.stringify(responses.at(-1))).not.toContain("I'm an automated assistant");
  });

  it("asks for the missing digits when a callback number is incomplete", async () => {
    const socket = createFakeRealtimeSocket();
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return {
            ...demoRestaurantContext,
            restaurantName: "Summit Air",
            vertical: "hvac",
          };
        },
      },
      {
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
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_incomplete_phone",
          sip_headers: [{ name: "From", value: "sip:+16034899218@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.created" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_greeting",
        transcript: "Thank you for calling Summit Air. How can I help you?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ type: "response.audio.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_phone_prompt",
        transcript: "Sure. What's your name and best callback number?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_partial_phone",
        transcript: "My name is Kim Schneider, and my callback number is 603-489-92.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await flushAsyncWork();

    const responses = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
    expect(responses.at(-1)).toMatchObject({
      response: {
        instructions: expect.stringContaining("I only got 603-489-92. Could you repeat the rest of the phone number?"),
      },
    });
    expect(JSON.stringify(responses.at(-1))).not.toContain("Customer request saved");
  });

  it("accepts short restaurant intents instead of filtering them as background noise", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_short_restaurant_intent",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_reservations",
        transcript: "Uh, reservations.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns[0]).toMatchObject({
      speaker: "caller",
      text: "Uh, reservations.",
    });
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
  });

  it("accepts short configured menu items as caller intent", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_short_menu_intent",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_meatballs",
        transcript: "Meatballs.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns[0]).toMatchObject({
      speaker: "caller",
      text: "Meatballs.",
    });
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
  });

  it("lets natural ambiguous caller speech reach the model after the greeting", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_natural_speech",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_natural",
        transcript: "Maybe something hearty.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns[0]).toMatchObject({
      speaker: "caller",
      text: "Maybe something hearty.",
    });
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
  });

  it("coalesces clustered caller transcript fragments into one realtime response", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_clustered_fragments",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_followup_question",
        transcript: "Is anyone really going to follow up?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_fragment",
        transcript: "Sure.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ speaker: "caller", text: "Is anyone really going to follow up?" }),
        expect.objectContaining({ speaker: "caller", text: "Sure." }),
      ]),
    );
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
  });

  it("waits for address fragments before starting the next response", async () => {
    vi.useFakeTimers();
    try {
      const socket = createFakeRealtimeSocket();
      const transcriptTurns: unknown[] = [];
      const service = createOpenAIRealtimeSipService(
        {
          ...baseEnv,
          OPENAI_REALTIME_DETAIL_CAPTURE_RESPONSE_DELAY_MS: 1300,
          OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS: 650,
        },
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
            async completeCall() {},
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
            async startRealtimeCall() {
              return { callId: "call_uuid" };
            },
          },
          fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
          websocketFactory: () => socket as never,
        },
      );

      await service.handleIncomingWebhook({
        headers: {},
        rawBody: JSON.stringify({
          data: {
            call_id: "rtc_address_fragments",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "agent_address_question",
          response_id: "resp_address_question",
          transcript: "What's the address where you need the plumber to come out?",
          type: "response.output_audio_transcript.done",
        })),
      );
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "caller_address_1",
          transcript: "Five Old Barn Road.",
          type: "conversation.item.input_audio_transcription.completed",
        })),
      );
      await Promise.resolve();

      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(500);
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "caller_address_2",
          transcript: "In Duxbury, Massachusetts.",
          type: "conversation.item.input_audio_transcription.completed",
        })),
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1799);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(transcriptTurns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ speaker: "caller", text: "Five Old Barn Road." }),
          expect.objectContaining({ speaker: "caller", text: "In Duxbury, Massachusetts." }),
        ]),
      );
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for scheduling date fragments before starting the next response", async () => {
    vi.useFakeTimers();
    try {
      const socket = createFakeRealtimeSocket();
      const transcriptTurns: unknown[] = [];
      const service = createOpenAIRealtimeSipService(
        {
          ...baseEnv,
          OPENAI_REALTIME_DETAIL_CAPTURE_RESPONSE_DELAY_MS: 1300,
          OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS: 650,
        },
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
            async completeCall() {},
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
            async startRealtimeCall() {
              return { callId: "call_uuid" };
            },
          },
          fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
          websocketFactory: () => socket as never,
        },
      );

      await service.handleIncomingWebhook({
        headers: {},
        rawBody: JSON.stringify({
          data: {
            call_id: "rtc_scheduling_fragments",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "caller_schedule_1",
          transcript: "Could you come next Friday?",
          type: "conversation.item.input_audio_transcription.completed",
        })),
      );
      await Promise.resolve();

      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(700);
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "caller_schedule_2",
          transcript: "At 11 AM.",
          type: "conversation.item.input_audio_transcription.completed",
        })),
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(649);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(transcriptTurns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ speaker: "caller", text: "Could you come next Friday?" }),
          expect.objectContaining({ speaker: "caller", text: "At 11 AM." }),
        ]),
      );
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps buffering single-word address fragments before asking the next question", async () => {
    vi.useFakeTimers();
    try {
      const socket = createFakeRealtimeSocket();
      const transcriptTurns: unknown[] = [];
      const service = createOpenAIRealtimeSipService(
        {
          ...baseEnv,
          OPENAI_REALTIME_DETAIL_CAPTURE_RESPONSE_DELAY_MS: 1300,
          OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS: 650,
        },
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
            async completeCall() {},
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
            async startRealtimeCall() {
              return { callId: "call_uuid" };
            },
          },
          fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
          websocketFactory: () => socket as never,
        },
      );

      await service.handleIncomingWebhook({
        headers: {},
        rawBody: JSON.stringify({
          data: {
            call_id: "rtc_single_word_address_fragments",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "agent_address_question",
          response_id: "resp_address_question",
          transcript: "What's the address where you need the plumber to come out?",
          type: "response.output_audio_transcript.done",
        })),
      );
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));

      for (const [index, transcript] of ["Five.", "Old.", "Barn.", "Road.", "In Duxbury, Massachusetts."].entries()) {
        socket.emit(
          "message",
          Buffer.from(JSON.stringify({
            item_id: `caller_address_fragment_${index}`,
            transcript,
            type: "conversation.item.input_audio_transcription.completed",
          })),
        );
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(500);
      }

      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1299);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(transcriptTurns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ speaker: "caller", text: "Five." }),
          expect.objectContaining({ speaker: "caller", text: "Old." }),
          expect.objectContaining({ speaker: "caller", text: "Barn." }),
          expect.objectContaining({ speaker: "caller", text: "Road." }),
          expect.objectContaining({ speaker: "caller", text: "In Duxbury, Massachusetts." }),
        ]),
      );
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels active audio when the caller says they were not done", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_caller_repair_interrupt",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_time_question",
        response_id: "resp_time_question",
        transcript: "Are you looking for something this week, morning or afternoon?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { id: "resp_premature" },
        type: "response.created",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_repair",
        transcript: "I didn't even answer, but I would say in the next couple of days you could do it.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          speaker: "caller",
          text: "I didn't even answer, but I would say in the next couple of days you could do it.",
        }),
      ]),
    );
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.cancel"))).toHaveLength(1);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "output_audio_buffer.clear"))).toHaveLength(1);
  });

  it("queues city and state fragments during a premature active response without cutting itself off", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_city_state_during_response",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_address_question",
        response_id: "resp_address_question",
        transcript: "What's the address where you'd like service?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { id: "resp_premature" },
        type: "response.created",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_city_state",
        transcript: "In Duxbury, Massachusetts.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ speaker: "caller", text: "In Duxbury, Massachusetts." }),
      ]),
    );
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.cancel"))).toHaveLength(0);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "output_audio_buffer.clear"))).toHaveLength(0);
  });

  it("waits for spelled name fragments before thanking the caller", async () => {
    vi.useFakeTimers();
    try {
      const socket = createFakeRealtimeSocket();
      const transcriptTurns: unknown[] = [];
      const service = createOpenAIRealtimeSipService(
        {
          ...baseEnv,
          OPENAI_REALTIME_DETAIL_CAPTURE_RESPONSE_DELAY_MS: 1300,
          OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS: 650,
        },
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
            async completeCall() {},
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
            async startRealtimeCall() {
              return { callId: "call_uuid" };
            },
          },
          fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
          websocketFactory: () => socket as never,
        },
      );

      await service.handleIncomingWebhook({
        headers: {},
        rawBody: JSON.stringify({
          data: {
            call_id: "rtc_spelled_name_fragments",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "agent_name_question",
          response_id: "resp_name_question",
          transcript: "And your name?",
          type: "response.output_audio_transcript.done",
        })),
      );
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "caller_name_1",
          transcript: "It's Tim Schneider.",
          type: "conversation.item.input_audio_transcription.completed",
        })),
      );
      await Promise.resolve();

      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(500);
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          item_id: "caller_name_2",
          transcript: "S C H N E I D E R.",
          type: "conversation.item.input_audio_transcription.completed",
        })),
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1799);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(transcriptTurns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ speaker: "caller", text: "It's Tim Schneider." }),
          expect.objectContaining({ speaker: "caller", text: "S C H N E I D E R." }),
        ]),
      );
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still rejects obvious background media after the greeting", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_background_after_greeting",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "tv_after_greeting",
        transcript: "Coming up next tonight after the break.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toHaveLength(0);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
  });

  it("rejects recent agent audio when it returns as caller echo", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_agent_echo",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_confirmation",
        transcript: "Your reservation request is in, and staff will confirm it shortly.",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_echo",
        transcript: "Your reservation request is in and staff will confirm it shortly.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual([
      expect.objectContaining({
        speaker: "agent",
        text: "Your reservation request is in, and staff will confirm it shortly.",
      }),
    ]);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);
  });

  it("rejects business self-introduction echo while preserving real identity questions", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
    const summitContext: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "hvac",
      restaurantName: "Summit Air",
    };
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return summitContext;
        },
      },
      {
        callStore: {
          async addTranscriptTurn(input) {
            transcriptTurns.push(input);
          },
          async attachCallRecording() {},
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_business_identity_echo",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_identity_question",
        transcript: "Is this Summit Air?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    const responseCreatesBeforeEcho = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))
      .length;
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "business_name_echo",
        transcript: "Hello, this is Summit Air.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual([
      expect.objectContaining({
        speaker: "caller",
        text: "Is this Summit Air?",
      }),
    ]);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "conversation.item.delete"))).toEqual([
      expect.objectContaining({
        item_id: "business_name_echo",
        type: "conversation.item.delete",
      }),
    ]);
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(
      responseCreatesBeforeEcho,
    );
  });

  it("treats repeated hello as a real reconnect attempt after a glitch", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_hello",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        response: { output: [] },
        type: "response.done",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_hello",
        transcript: "Hello? Hello?",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns[0]).toMatchObject({
      speaker: "caller",
      text: "Hello? Hello?",
    });
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
  });

  it("accepts short caller answers after SignalHost asks a direct question", async () => {
    const socket = createFakeRealtimeSocket();
    const transcriptTurns: unknown[] = [];
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
          async completeCall() {},
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
          async startRealtimeCall() {
            return { callId: "call_uuid" };
          },
        },
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_short_answer",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    socket.emit("open");
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_order",
        transcript: "I wanted to order takeout.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "agent_question",
        transcript: "Happy to help with that. What would you like to order tonight?",
        type: "response.output_audio_transcript.done",
      })),
    );
    socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({
        item_id: "caller_short_food",
        transcript: "Dim sum, chum.",
        type: "conversation.item.input_audio_transcription.completed",
      })),
    );
    await Promise.resolve();

    expect(transcriptTurns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ speaker: "caller", text: "Dim sum, chum." }),
      ]),
    );
    expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(3);
  });

  it("creates a manual still-here prompt when the caller goes quiet", async () => {
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
            call_id: "rtc_idle",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({
          response: { output: [] },
          type: "response.done",
        })),
      );
      await vi.advanceTimersByTimeAsync(18000);

      const responseCreates = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
      expect(responseCreates).toHaveLength(2);
      expect(responseCreates[1]).toMatchObject({
        response: expect.objectContaining({
          instructions: expect.stringContaining("I'm still here"),
        }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not hang up after only one unanswered idle check-in", async () => {
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
            call_id: "rtc_idle_patience",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      await vi.advanceTimersByTimeAsync(18000);
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      await vi.advanceTimersByTimeAsync(18000);

      const responseCreates = socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"));
      expect(responseCreates).toHaveLength(3);
      expect(JSON.stringify(responseCreates[1])).toContain("I'm still here");
      expect(JSON.stringify(responseCreates[2])).toContain("I'm still here");
      expect(JSON.stringify(responseCreates[2])).not.toContain("Goodbye");
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses the idle timer while caller speech is detected", async () => {
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
            call_id: "rtc_idle_speech",
            sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
          },
          type: "realtime.call.incoming",
        }),
      });

      socket.emit("open");
      socket.emit("message", Buffer.from(JSON.stringify({ response: { output: [] }, type: "response.done" })));
      await vi.advanceTimersByTimeAsync(14000);
      socket.emit("message", Buffer.from(JSON.stringify({ type: "input_audio_buffer.speech_started" })));
      await vi.advanceTimersByTimeAsync(3000);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(1);

      socket.emit("message", Buffer.from(JSON.stringify({ type: "input_audio_buffer.speech_stopped" })));
      await vi.advanceTimersByTimeAsync(15000);
      expect(socket.sentEvents.filter((event) => isRealtimeEventType(event, "response.create"))).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts a trusted owner SIP caller with owner tools and identity metadata", async () => {
    const socket = createFakeRealtimeSocket();
    const startedCalls: unknown[] = [];
    const acceptedPayloads: unknown[] = [];
    const service = createOpenAIRealtimeSipService(
      baseEnv,
      {
        async getContext() {
          return demoRestaurantContext;
        },
      },
      {
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
        fetchImpl: (async (_url, init) => {
          acceptedPayloads.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 200 });
        }) as typeof fetch,
        ownerCommandRuntime: {
          configured: true,
          async runCommand() {
            return {
              applied: false,
              decision: "allowed",
              kind: "report_query",
              message: "Tell the owner: I handled 3 calls today.",
              ok: true,
              spokenResponse: "I handled 3 calls today.",
              title: "Today at a glance",
            };
          },
        },
        websocketFactory: () => socket as never,
      },
    );

    const result = await service.handleIncomingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_owner",
          sip_headers: [
            { name: "X-Twilio-CallSid", value: "CAOWNER" },
            { name: "From", value: "sip:+14155550148@twilio.com" },
          ],
        },
        id: "evt_owner",
        object: "event",
        type: "realtime.call.incoming",
      }),
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ownerMode: true });
    expect(startedCalls[0]).toMatchObject({
      callerName: "Maria",
      providerPayload: {
        ownerContactId: "trusted_demo_owner",
        ownerMode: true,
      },
    });
    expect(acceptedPayloads[0]).toMatchObject({
      instructions: expect.stringContaining("internal owner-assistant call"),
      tools: [
        expect.objectContaining({ name: "run_owner_command" }),
        expect.objectContaining({ name: "finish_call" }),
      ],
    });

    socket.emit("open");
    expect(socket.sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          session: expect.objectContaining({
            instructions: expect.stringContaining("internal owner-assistant call"),
            tools: [
              expect.objectContaining({ name: "run_owner_command" }),
              expect.objectContaining({ name: "finish_call" }),
            ],
          }),
          type: "session.update",
        }),
        expect.objectContaining({
          response: expect.objectContaining({
            instructions: expect.stringContaining("Hi Maria, it's SignalHost"),
          }),
          type: "response.create",
        }),
      ]),
    );
  });

  it("uses the male OpenAI voice for male configured hosts", () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      voiceGender: "male",
      voiceProfileId: "miles",
    };

    const payload = buildOpenAIRealtimeAcceptPayload({
      context,
      env: baseEnv,
    });

    expect(payload.audio.output.voice).toBe("cedar");
  });

  it("uses the business voice profile even when a global realtime voice fallback is configured", () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      voiceGender: "male",
      voiceProfileId: "aiden",
    };

    const payload = buildOpenAIRealtimeAcceptPayload({
      context,
      env: {
        ...baseEnv,
        OPENAI_REALTIME_VOICE: "marin",
      },
    });

    expect(payload.audio.output.voice).toBe("verse");
  });

  it("keeps the no-mid-call-restart guidance in the reusable instructions", () => {
    const instructions = buildOpenAIRealtimeInstructions(demoRestaurantContext);

    expect(instructions).toContain("one continuous live phone call");
    expect(instructions).toContain("Say the opening greeting once");
    expect(instructions).toContain("If the caller says 'hello' before you have greeted them");
    expect(instructions).toContain("Greeting energy");
    expect(instructions).toContain("not 'Thanks, Schneider.'");
    expect(instructions).toContain("Handle clear interruptions gracefully");
    expect(instructions).toContain("Noisy-room behavior");
    expect(instructions).toContain("Echo guardrail");
    expect(instructions).toContain("Can I help you with anything else?");
    expect(instructions).toContain("Thanks for calling. Goodbye.");
    expect(instructions).toContain("Do not call finish_call until");
    expect(instructions).toContain("Never say you are connecting, transferring, or placing the caller on hold");
  });

  it("builds a short opening greeting that does not introduce the host", () => {
    expect(buildShortOpeningGreeting(demoRestaurantContext)).toBe(
      "Thank you for calling Olive and Ember. How can I help you?",
    );
  });

  it("builds a warm opening greeting prompt using the short greeting", () => {
    const instructions = buildOpeningGreetingInstructions(demoRestaurantContext);

    expect(instructions).toContain("Say this exact opening greeting once");
    expect(instructions).toContain("Thank you for calling Olive and Ember. How can I help you?");
    expect(instructions).toContain("smile in your voice");
    expect(instructions).toContain("do not add your name");
  });

  it("clamps realtime playback speed to a safe phone range", () => {
    expect(resolveOpenAIRealtimeSpeed({ ...baseEnv, OPENAI_REALTIME_SPEED: "1.08" })).toBe(1.08);
    expect(resolveOpenAIRealtimeSpeed({ ...baseEnv, OPENAI_REALTIME_SPEED: "2" })).toBe(1.12);
    expect(resolveOpenAIRealtimeSpeed({ ...baseEnv, OPENAI_REALTIME_SPEED: "fast" })).toBe(1.02);
  });

  it("clamps the opening greeting delay so the phone audio path can connect", () => {
    expect(resolveOpenAIRealtimeGreetingDelayMs(baseEnv)).toBe(0);
    expect(resolveOpenAIRealtimeGreetingDelayMs({ ...baseEnv, OPENAI_REALTIME_GREETING_DELAY_MS: 900 })).toBe(900);
    expect(resolveOpenAIRealtimeGreetingDelayMs({ ...baseEnv, OPENAI_REALTIME_GREETING_DELAY_MS: 3000 })).toBe(2500);
    expect(resolveOpenAIRealtimeGreetingDelayMs({ ...baseEnv, OPENAI_REALTIME_GREETING_DELAY_MS: -1 })).toBe(0);
  });

  it("uses OpenAI semantic VAD with SignalHost response gating by default", () => {
    expect(resolveOpenAIRealtimeNoiseReduction(baseEnv)).toBe("far_field");
    expect(resolveOpenAIRealtimeInterruptResponse(baseEnv)).toBe(false);
    expect(resolveOpenAIRealtimeManualResponseGating(baseEnv)).toBe(true);
    expect(resolveOpenAIRealtimeServerVadThreshold(baseEnv)).toBe(0.88);
    expect(resolveOpenAIRealtimeServerVadSilenceMs(baseEnv)).toBe(900);
    expect(resolveOpenAIRealtimeServerVadPrefixPaddingMs(baseEnv)).toBe(150);
    expect(resolveOpenAIRealtimeIdleTimeoutMs(baseEnv)).toBe(15000);
    expect(resolveOpenAIRealtimeTurnDetection(baseEnv)).toMatchObject({
      create_response: false,
      eagerness: "low",
      interrupt_response: false,
      type: "semantic_vad",
    });
    expect(resolveOpenAIRealtimeTurnDetection(baseEnv)).not.toHaveProperty("threshold");
    expect(resolveOpenAIRealtimeTurnDetection(baseEnv)).not.toHaveProperty("idle_timeout_ms");
    expect(resolveOpenAIRealtimeTurnDetection({ ...baseEnv, OPENAI_REALTIME_MANUAL_RESPONSE_GATING: false })).toMatchObject({
      create_response: true,
      eagerness: "low",
      type: "semantic_vad",
    });
    expect(
      resolveOpenAIRealtimeTurnDetection({
        ...baseEnv,
        OPENAI_REALTIME_MANUAL_RESPONSE_GATING: false,
        OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
      }),
    ).toMatchObject({
      create_response: true,
      idle_timeout_ms: 15000,
      prefix_padding_ms: 150,
      silence_duration_ms: 900,
      threshold: 0.88,
      type: "server_vad",
    });
    expect(
      buildOpenAIRealtimeAcceptPayload({
        context: demoRestaurantContext,
        env: {
          ...baseEnv,
          OPENAI_REALTIME_INTERRUPT_RESPONSE: true,
          OPENAI_REALTIME_MANUAL_RESPONSE_GATING: false,
          OPENAI_REALTIME_NOISE_REDUCTION: "near_field",
          OPENAI_REALTIME_TURN_DETECTION_MODE: "semantic_vad",
          OPENAI_REALTIME_TURN_EAGERNESS: "high",
        },
      }).audio.input.turn_detection,
    ).toMatchObject({
      create_response: true,
      eagerness: "high",
      interrupt_response: false,
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

  it("extracts the called Twilio number from SIP destination headers", () => {
    expect(
      extractOpenAIRealtimeDestinationPhone({
        data: {
          to: "sip:proj_123@sip.api.openai.com;transport=tls",
          sip_headers: [
            { name: "To", value: "<sip:proj_123@sip.api.openai.com;transport=tls>" },
            { name: "Diversion", value: "<sip:+17814233898@twilio.com>;reason=unconditional" },
          ],
        },
      }),
    ).toBe("+17814233898");
  });

  it("uses the dialed phone number to select the location before accepting SIP calls", async () => {
    const socket = createFakeRealtimeSocket();
    const requestedLocations: Array<string | undefined> = [];
    const startedCalls: unknown[] = [];
    const service = createOpenAIRealtimeSipService(
      {
        ...baseEnv,
        SUPABASE_DEMO_LOCATION_ID: "fallback_location",
      },
      {
        async getContext(locationId) {
          requestedLocations.push(locationId);
          return {
            ...demoRestaurantContext,
            restaurantName: locationId === "hvac_location" ? "Summit Air" : "Olive & Ember",
          };
        },
        async resolveLocationIdByPhoneNumber(phoneNumber) {
          return phoneNumber === "+16175550181" ? "hvac_location" : undefined;
        },
      },
      {
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
          call_id: "rtc_hvac",
          sip_headers: [
            { name: "From", value: "sip:+14155550123@twilio.com" },
            { name: "Diversion", value: "<sip:+16175550181@twilio.com>;reason=unconditional" },
          ],
        },
        type: "realtime.call.incoming",
      }),
    });

    expect(result.status).toBe(200);
    expect(requestedLocations).toEqual(["hvac_location"]);
    expect(startedCalls[0]).toMatchObject({
      locationId: "hvac_location",
    });
  });

  it("uses the Agents SDK SIP accept payload for pilot locations while keeping the sideband active", async () => {
    const socket = createFakeRealtimeSocket();
    let acceptedPayload: any;
    const startedCalls: any[] = [];
    const service = createOpenAIRealtimeSipService(
      {
        ...baseEnv,
        OPENAI_REALTIME_AGENTS_SDK_LOCATION_IDS: "hvac_location",
      },
      {
        async getContext(locationId) {
          return {
            ...demoRestaurantContext,
            businessType: "hvac",
            restaurantName: locationId === "hvac_location" ? "Summit Air" : "Olive & Ember",
          };
        },
      },
      {
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
        fetchImpl: (async (_url, init) => {
          acceptedPayload = JSON.parse(String(init?.body));
          return new Response(null, { status: 200 });
        }) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    const result = await service.handleIncomingWebhook({
      headers: {},
      locationId: "hvac_location",
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_agents_sdk",
          sip_headers: [{ name: "From", value: "sip:+14155550123@twilio.com" }],
        },
        type: "realtime.call.incoming",
      }),
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      locationId: "hvac_location",
      realtimeAcceptProvider: "agents_sdk",
    });
    expect(startedCalls[0].providerPayload).toMatchObject({
      realtimeAcceptProvider: "agents_sdk",
    });
    expect(acceptedPayload.instructions).toContain("Summit Air");
    expect(acceptedPayload.audio.input.turn_detection).toMatchObject({
      create_response: false,
      eagerness: "low",
      interrupt_response: false,
      type: "semantic_vad",
    });
    expect(acceptedPayload.audio.input.turn_detection).not.toHaveProperty("threshold");
    expect(acceptedPayload.audio.input.turn_detection).not.toHaveProperty("prefix_padding_ms");
    expect(acceptedPayload.audio.input.turn_detection).not.toHaveProperty("silence_duration_ms");
    expect(acceptedPayload.tools.map((tool: { name: string }) => tool.name)).toContain("lookup_business_context");
  });

  it("lets the dialed phone number override a stale webhook location query param", async () => {
    const socket = createFakeRealtimeSocket();
    const requestedLocations: Array<string | undefined> = [];
    const service = createOpenAIRealtimeSipService(
      {
        ...baseEnv,
        SUPABASE_DEMO_LOCATION_ID: "olive_location",
      },
      {
        async getContext(locationId) {
          requestedLocations.push(locationId);
          return {
            ...demoRestaurantContext,
            restaurantName: locationId === "hvac_location" ? "Summit Air" : "Olive & Ember",
          };
        },
        async resolveLocationIdByPhoneNumber(phoneNumber) {
          return phoneNumber === "+16175450460" ? "hvac_location" : undefined;
        },
      },
      {
        fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
        websocketFactory: () => socket as never,
      },
    );

    const result = await service.handleIncomingWebhook({
      headers: {},
      locationId: "olive_location",
      rawBody: JSON.stringify({
        data: {
          call_id: "rtc_hvac",
          sip_headers: [
            { name: "From", value: "sip:+14155550123@twilio.com" },
            { name: "Diversion", value: "<sip:+16175450460@twilio.com>;reason=unconditional" },
          ],
        },
        type: "realtime.call.incoming",
      }),
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      locationId: "hvac_location",
    });
    expect(requestedLocations).toEqual(["hvac_location"]);
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

    expect(
      finishOpenAIRealtimeCall({
        rawArguments: {
          closing_line: "Great! Have a wonderful day, and enjoy your time at Olive and Ember.",
          reason: "caller_done",
        },
      }),
    ).toMatchObject({
      action: "finish_call",
      closingLine: "Thanks for calling. Goodbye.",
      ok: true,
    });
  });

  it("does not finish the call when the latest caller turn is not a goodbye", () => {
    expect(
      finishOpenAIRealtimeCall({
        lastCallerText: "Yes, please.",
        rawArguments: {
          closing_line: "Thanks for calling. Goodbye.",
          reason: "caller_done",
        },
      }),
    ).toMatchObject({
      error: "caller_not_done",
      ok: false,
    });

    expect(
      finishOpenAIRealtimeCall({
        lastCallerText: "No thanks, that's all.",
        rawArguments: {
          closing_line: "Thanks for calling. Goodbye.",
          reason: "caller_done",
        },
      }),
    ).toMatchObject({
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
        reason: "SignalHost call completed.",
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

  it("returns menu item matches for direct item availability lookups", () => {
    const pizza = lookupRestaurantContext(demoRestaurantContext, "Do you have pizza?");
    const meatballs = lookupRestaurantContext(demoRestaurantContext, "Can I get meatballs?");

    expect(JSON.stringify(pizza)).toContain("Margherita Pizza");
    expect(JSON.stringify(pizza)).toContain("Diavola Pizza");
    expect(JSON.stringify(pizza)).toContain("matchedOfferingItems");
    expect(JSON.stringify(meatballs)).toContain("Meatballs");
    expect(JSON.stringify(meatballs)).toContain("$13.00");
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
      message: "Text sent.",
      phoneNumber: "+14155550123",
      sentToLastFour: "0123",
    });
  });

  it("labels service request texts as summaries instead of confirmations", async () => {
    const result = await sendOpenAIRealtimeGuestConfirmation({
      callerPhone: "+14155550123",
      context: demoRestaurantContext,
      rawArguments: {
        kind: "service_appointment",
        message: "Your service request was received.",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      message: "Text request summary sent.",
      phoneNumber: "+14155550123",
      sentToLastFour: "0123",
    });
  });

  it("looks up service-business context with neutral labels", () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "plumbing",
      restaurantName: "Harbor Plumbing",
      menuHighlights: ["Leaks", "Drains", "Water heaters"],
      menuItems: [],
      policies: {
        ...demoRestaurantContext.policies,
        hours: "Open weekdays 8 AM to 6 PM.",
        location: "Serving Somerville and Cambridge.",
        menu: "Service catalog includes leaks, drains, and water heaters.",
        reservations: "Appointments are staff-confirmed.",
      },
    };

    const result = lookupBusinessContext(context, "water heater appointment") as {
      businessName?: string;
      businessType?: string;
      currentBusinessTime?: string;
      offeringHighlights?: string[];
      profile?: { businessNoun?: string; offeringNoun?: string; staffNoun?: string };
      restaurantName?: string;
    };

    expect(result.businessName).toBe("Harbor Plumbing");
    expect(result.businessType).toBe("plumbing");
    expect(result.currentBusinessTime).toBeTruthy();
    expect(result.offeringHighlights).toContain("Water heaters");
    expect(result.profile).toMatchObject({
      businessNoun: "plumbing company",
      offeringNoun: "service catalog",
      staffNoun: "dispatcher",
    });
    expect(result.restaurantName).toBeUndefined();
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
        formatted_address: "5 Old Barn Rd, Duxbury, MA 02332, USA",
        address_latitude: 42.031,
        address_longitude: -70.68,
        address_status: "validated",
        google_maps_uri: "https://maps.google.com/?cid=123",
        google_place_id: "place_123",
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
      message:
        "Customer request saved for staff follow-up. Do not call this a confirmed appointment; tell the caller staff will confirm timing shortly.",
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
      details: expect.objectContaining({
        addressLatitude: 42.031,
        addressLongitude: -70.68,
        addressStatus: "validated",
        formattedAddress: "5 Old Barn Rd, Duxbury, MA 02332, USA",
        googleMapsUri: "https://maps.google.com/?cid=123",
        googlePlaceId: "place_123",
        issue: "water heater leaking",
        serviceAddress: "5 Old Barn Rd, Duxbury, MA 02332, USA",
      }),
    });
  });

  it("normalizes caller addresses before saving request details", async () => {
    const result = await normalizeOpenAIRealtimeCustomerAddress({
      context: demoRestaurantContext,
      env: baseEnv,
      rawArguments: {
        raw_address: "5 Old Barn Road, Duxbury, Massachusetts",
        unit_or_access: "Suite 4",
      },
    });

    expect(result).toMatchObject({
      formattedAddress: "5 Old Barn Road Suite 4, Duxbury, Massachusetts",
      status: "likely_complete_unverified",
    });
    expect(result.callerGuidance).toContain("read back exactly");
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

  it("rejects refusal phrases as reservation guest names", async () => {
    const savedReservations: unknown[] = [];
    const result = await createOpenAIRealtimeReservationRequest({
      callRecordId: "call_uuid",
      callerPhone: "+14155550123",
      context: demoRestaurantContext,
      locationId: "location_uuid",
      rawArguments: {
        guest_name: "No",
        party_size: 2,
        reservation_date: "2026-05-12",
        reservation_time: "18:00",
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
      error: "missing_reservation_details",
      missing: ["guest_name"],
      ok: false,
    });
    expect(String(result.message)).toContain("Do not treat words like no");
    expect(savedReservations).toHaveLength(0);
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

  it("can auto-confirm SignalHost Lite reservations within configured rules", async () => {
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

function isRealtimeEventType(event: unknown, type: string) {
  return Boolean(event && typeof event === "object" && (event as { type?: unknown }).type === type);
}

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
