import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceServiceEnv } from "./env";
import type { CallStore } from "./call-store";
import { demoRestaurantContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import { buildVapiAssistantDraft, buildVapiPilotConfig, createVapiPilotService } from "./vapi-pilot";

const baseEnv = {
  PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
  VAPI_API_KEY: "vapi_test",
  VAPI_OPENAI_MODEL: "gpt-realtime-2025-08-28",
  VAPI_OPENAI_VOICE_ID: "marin",
  VAPI_PILOT_ENABLED: true,
  VAPI_WEBHOOK_SECRET: "secret",
} as Partial<VoiceServiceEnv> as VoiceServiceEnv;

const contextStore: RestaurantContextStore = {
  getContext: vi.fn(async () => demoRestaurantContext),
};

const callStore: CallStore = {
  addTranscriptTurn: vi.fn(async () => undefined),
  attachCallRecording: vi.fn(async () => undefined),
  completeCall: vi.fn(async () => undefined),
  createCustomerRequest: vi.fn(async () => ({ requestId: "request_1", taskId: "task_1" })),
  createStaffReviewOrder: vi.fn(async () => ({ orderId: "order_1" })),
  createStaffReviewReservation: vi.fn(async () => ({ reservationId: "reservation_1" })),
  createStaffTask: vi.fn(async () => ({ taskId: "task_2" })),
  startCall: vi.fn(async () => ({ callId: "call_1" })),
  startRealtimeCall: vi.fn(async () => ({ callId: "call_1" })),
};

describe("Vapi pilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds an isolated pilot config without changing the primary OpenAI SIP path", () => {
    const config = buildVapiPilotConfig(baseEnv, demoRestaurantContext, "loc_1");

    expect(config.ready).toBe(true);
    expect(config.allowedLocationIds).toEqual([]);
    expect(config.serverUrl).toBe("https://voice.signalhost.ai/vapi/webhook?locationId=loc_1");
    expect(config.assistantPreview).toMatchObject({
      firstMessage: "Thank you for calling Olive and Ember. How can I help you?",
      firstMessageInterruptionsEnabled: false,
      name: "SignalHost Olive & Ember",
    });
  });

  it("includes SignalHost instructions and tool functions in the assistant draft", () => {
    const assistant = buildVapiAssistantDraft({ context: demoRestaurantContext, env: baseEnv, locationId: "loc_1" });

    expect(assistant.model).toMatchObject({
      provider: "openai",
      model: "gpt-5.2-chat-latest",
    });
    expect(assistant.voice).toMatchObject({
      provider: "vapi",
      voiceId: "Elliot",
    });
    expect(JSON.stringify(assistant.model)).toContain("Never call a customer a lead");
    expect(JSON.stringify(assistant.model)).toContain("lookup_restaurant_context");
    expect(assistant.model.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "function",
        function: expect.objectContaining({
          name: "lookup_restaurant_context",
        }),
      }),
    ]));
    expect(assistant).toHaveProperty("transcriber");
    expect(assistant.server).toMatchObject({
      headers: {
        "x-vapi-secret": "secret",
      },
      url: "https://voice.signalhost.ai/vapi/webhook?locationId=loc_1",
    });
  });

  it("keeps Deepgram transcriber config and Vapi voice for non-realtime Vapi model tests", () => {
    const env = { ...baseEnv, VAPI_OPENAI_MODEL: "gpt-4o-mini", VAPI_OPENAI_VOICE_ID: "nova" } as VoiceServiceEnv;
    const assistant = buildVapiAssistantDraft({ context: demoRestaurantContext, env, locationId: "loc_1" });

    expect(assistant.model).toMatchObject({
      model: "gpt-4o-mini",
      provider: "openai",
    });
    expect(assistant).toHaveProperty("transcriber");
    expect(assistant.voice).toMatchObject({
      provider: "vapi",
      voiceId: "Elliot",
    });
  });

  it("allows an explicit OpenAI voice provider when intentionally configured", () => {
    const env = {
      ...baseEnv,
      VAPI_OPENAI_MODEL: "gpt-5.2-instant",
      VAPI_OPENAI_VOICE_ID: "marin",
      VAPI_VOICE_PROVIDER: "openai",
    } as VoiceServiceEnv;
    const assistant = buildVapiAssistantDraft({ context: demoRestaurantContext, env, locationId: "loc_1" });

    expect(assistant.voice).toMatchObject({
      provider: "openai",
      voiceId: "marin",
    });
  });

  it("maps dashboard-style instant model labels to Vapi API model ids", () => {
    const env = { ...baseEnv, VAPI_OPENAI_MODEL: "gpt-5.2-instant" } as VoiceServiceEnv;
    const assistant = buildVapiAssistantDraft({ context: demoRestaurantContext, env, locationId: "loc_1" });

    expect(assistant.model).toMatchObject({
      model: "gpt-5.2-chat-latest",
      provider: "openai",
    });
  });

  it("keeps the pilot disabled unless VAPI_PILOT_ENABLED is explicitly true", () => {
    const env = { ...baseEnv, VAPI_PILOT_ENABLED: false } as VoiceServiceEnv;
    const config = buildVapiPilotConfig(env, demoRestaurantContext, "loc_1");

    expect(config.enabled).toBe(false);
    expect(config.ready).toBe(false);
  });

  it("rejects webhook calls for locations outside the allowlist", async () => {
    const env = { ...baseEnv, VAPI_PILOT_LOCATION_IDS: "pilot_loc" } as VoiceServiceEnv;
    const service = createVapiPilotService(env, { callStore, restaurantContextStore: contextStore });
    const result = await service.handleWebhook({
      headers: {
        authorization: "Bearer secret",
      },
      rawBody: JSON.stringify({
        message: {
          call: { id: "vapi_call_not_allowed", customer: { number: "+15551234567" } },
          metadata: { locationId: "other_loc" },
          type: "assistant-request",
        },
      }),
    });

    expect(result.status).toBe(403);
    expect(callStore.startRealtimeCall).not.toHaveBeenCalledWith(expect.objectContaining({
      externalCallId: "vapi_call_not_allowed",
    }));
  });

  it("returns a dynamic assistant for Vapi assistant-request events", async () => {
    const service = createVapiPilotService(baseEnv, { callStore, restaurantContextStore: contextStore });
    const result = await service.handleWebhook({
      headers: {
        authorization: "Bearer secret",
      },
      rawBody: JSON.stringify({
        message: {
          call: { id: "vapi_call_1", customer: { number: "+15551234567" } },
          metadata: { locationId: "loc_1" },
          type: "assistant-request",
        },
      }),
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      assistant: {
        firstMessage: "Thank you for calling Olive and Ember. How can I help you?",
      },
    });
    expect(callStore.startRealtimeCall).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body).length).toBeLessThan(25000);
  });

  it("handles Vapi tool calls through the shared SignalHost call store", async () => {
    const service = createVapiPilotService(baseEnv, { callStore, restaurantContextStore: contextStore });
    const result = await service.handleWebhook({
      headers: {
        authorization: "Bearer secret",
      },
      rawBody: JSON.stringify({
        message: {
          call: { id: "vapi_call_2", customer: { number: "+15551234567" } },
          metadata: { locationId: "loc_1" },
          toolCallList: [
            {
              id: "tool_1",
              name: "create_customer_request",
              parameters: {
                request_type: "quote",
                summary: "Caller wants a quote.",
                urgency: "high",
              },
            },
          ],
          type: "tool-calls",
        },
      }),
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      results: [
        {
          name: "create_customer_request",
          toolCallId: "tool_1",
        },
      ],
    });
    expect(callStore.createCustomerRequest).toHaveBeenCalledWith(expect.objectContaining({
      priority: "high",
      requestType: "quote",
      summary: "Caller wants a quote.",
    }));
  });

  it("creates a Vapi phone number and attaches the synced assistant", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "pn_1",
      number: "+17815230283",
    }), { status: 201 }));
    const service = createVapiPilotService(baseEnv, {
      callStore,
      fetchImpl: fetchMock as unknown as typeof fetch,
      restaurantContextStore: contextStore,
    });

    const result = await service.syncPhoneNumber({
      assistantId: "asst_1",
      locationId: "loc_1",
      name: "SignalHost Harbor Plumbing",
      numberDesiredAreaCode: "781",
    });

    expect(result.status).toBe(201);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vapi.ai/phone-number",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestBody).toEqual({
      assistantId: "asst_1",
      name: "SignalHost Harbor Plumbing",
      numberDesiredAreaCode: "781",
      provider: "vapi",
    });
  });

  it("creates a Vapi phone number that requests its assistant dynamically from SignalHost", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "pn_dynamic",
      number: "+17815230283",
    }), { status: 201 }));
    const service = createVapiPilotService(baseEnv, {
      callStore,
      fetchImpl: fetchMock as unknown as typeof fetch,
      restaurantContextStore: contextStore,
    });

    const result = await service.syncPhoneNumber({
      locationId: "loc_1",
      name: "SignalHost Harbor Plumbing",
      numberDesiredAreaCode: "781",
    });

    expect(result.status).toBe(201);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toEqual({
      name: "SignalHost Harbor Plumbing",
      numberDesiredAreaCode: "781",
      provider: "vapi",
      server: {
        headers: {
          "x-vapi-secret": "secret",
        },
        timeoutSeconds: 20,
        url: "https://voice.signalhost.ai/vapi/webhook?locationId=loc_1",
      },
    });
  });

  it("updates an existing Vapi phone number without changing its provider or area code", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "pn_existing",
      number: "+17815230283",
    }), { status: 200 }));
    const service = createVapiPilotService(baseEnv, {
      callStore,
      fetchImpl: fetchMock as unknown as typeof fetch,
      restaurantContextStore: contextStore,
    });

    const result = await service.syncPhoneNumber({
      assistantId: "asst_1",
      locationId: "loc_1",
      name: "SignalHost Harbor Plumbing",
      phoneNumberId: "pn_existing",
    });

    expect(result.status).toBe(200);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vapi.ai/phone-number/pn_existing",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
    expect(requestBody).toEqual({
      assistantId: "asst_1",
      name: "SignalHost Harbor Plumbing",
    });
  });
});
