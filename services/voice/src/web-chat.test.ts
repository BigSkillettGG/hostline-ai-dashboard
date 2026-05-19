import { afterEach, describe, expect, it, vi } from "vitest";
import type { CallStore } from "./call-store";
import { demoRestaurantContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import { createWebChatService } from "./web-chat";

const env = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
} as never;

const restaurantContext = {
  ...demoRestaurantContext,
  businessLinks: [
    {
      kind: "ordering" as const,
      label: "Order online",
      url: "https://oliveandember.example/order",
    },
    {
      kind: "reservation" as const,
      label: "Book a table",
      url: "https://oliveandember.example/reserve",
    },
  ],
};

const contextStore: RestaurantContextStore = {
  async getContext() {
    return restaurantContext;
  },
};

describe("web chat service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the Responses API to return a configured business link", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: [
              {
                arguments: "{\"link_kind\":\"ordering\"}",
                call_id: "tool_1",
                name: "get_business_link",
                type: "function_call",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ output_text: "You can order here: https://oliveandember.example/order" }),
          { status: 200 },
        ),
      );

    const service = createWebChatService(env, contextStore);
    const result = await service.handleMessage({
      message: "Can I order online?",
      transcript: [],
    });

    expect(result.reply).toContain("https://oliveandember.example/order");
    expect(result.actions).toEqual([
      {
        link: restaurantContext.businessLinks[0],
        type: "business_link",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstBody.instructions).toContain("Channel: website chat");
    expect(firstBody.instructions).toContain("Order online");
    expect(firstBody.instructions).toContain("normalize_customer_address");
    expect(firstBody.tools.map((tool: { name: string }) => tool.name)).toContain("get_business_link");
    expect(firstBody.tools.map((tool: { name: string }) => tool.name)).toContain("normalize_customer_address");
  });

  it("creates a customer request when staff follow-up is needed", async () => {
    const createdRequests: unknown[] = [];
    const callStore = buildFakeCallStore({
      async startRealtimeCall() {
        return { callId: "call_web_123" };
      },
      async createCustomerRequest(input) {
        createdRequests.push(input);
        return {
          requestId: "req_123",
          taskId: "task_123",
        };
      },
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: [
              {
                arguments: JSON.stringify({
                  callback_phone: "+15551234567",
                  customer_name: "Sam",
                  details: {
                    issue: "leaking sink",
                  },
                  formatted_address: "5 Old Barn Rd, Duxbury, MA 02332, USA",
                  address_latitude: 42.031,
                  address_longitude: -70.68,
                  address_status: "validated",
                  google_maps_uri: "https://maps.google.com/?cid=123",
                  google_place_id: "place_123",
                  request_type: "service appointment",
                  summary: "Sam wants help with a leaking sink.",
                  urgency: "high",
                }),
                call_id: "tool_2",
                name: "create_customer_request",
                type: "function_call",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output_text: "Got it. I sent that to the team for follow-up." }), {
          status: 200,
        }),
      );

    const service = createWebChatService(env, contextStore, { callStore });
    const result = await service.handleMessage({
      locationId: "loc_123",
      message: "I need scheduling help for a leaking sink.",
      transcript: [
        {
          role: "assistant",
          text: "Hi, how can I help?",
        },
      ],
    });

    expect(result.actions).toEqual([
      {
        requestId: "req_123",
        requestType: "service_appointment",
        taskId: "task_123",
        type: "customer_request",
      },
    ]);
    expect(createdRequests).toEqual([
      expect.objectContaining({
        callId: "call_web_123",
        customerName: "Sam",
        customerPhone: "+15551234567",
        locationId: "loc_123",
        priority: "high",
        requestType: "service_appointment",
        summary: "Sam wants help with a leaking sink.",
        details: expect.objectContaining({
          addressLatitude: 42.031,
          addressLongitude: -70.68,
          addressStatus: "validated",
          formattedAddress: "5 Old Barn Rd, Duxbury, MA 02332, USA",
          googleMapsUri: "https://maps.google.com/?cid=123",
          googlePlaceId: "place_123",
          issue: "leaking sink",
          serviceAddress: "5 Old Barn Rd, Duxbury, MA 02332, USA",
        }),
      }),
    ]);
  });

  it("persists each website chat exchange as a transcript-backed call", async () => {
    const starts: unknown[] = [];
    const turns: unknown[] = [];
    const completions: unknown[] = [];
    const callStore = buildFakeCallStore({
      async addTranscriptTurn(input) {
        turns.push(input);
      },
      async completeCall(input) {
        completions.push(input);
      },
      async startRealtimeCall(input) {
        starts.push(input);
        return { callId: "call_web_456" };
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: "Tonight's specials are branzino and mushroom risotto. Anything else I can help with?" }), {
        status: 200,
      }),
    );

    const service = createWebChatService(env, contextStore, { callStore });
    const result = await service.handleMessage({
      conversationId: "webchat_test_456",
      message: "What are the specials tonight?",
      visitorId: "visitor_456",
      visitorName: "Dana",
      visitorPhone: "+15550001111",
    });

    expect(result.callId).toBe("call_web_456");
    expect(result.conversationId).toBe("webchat_test_456");
    expect(starts).toEqual([
      expect.objectContaining({
        callerName: "Dana",
        callerPhone: "+15550001111",
        externalCallId: "webchat_test_456",
        externalSessionId: "visitor_456",
        provider: "web_chat",
        providerPayload: expect.objectContaining({
          channel: "web_chat",
          visitorId: "visitor_456",
        }),
      }),
    ]);
    expect(turns).toEqual([
      expect.objectContaining({
        callId: "call_web_456",
        speaker: "caller",
        text: "What are the specials tonight?",
      }),
      expect.objectContaining({
        callId: "call_web_456",
        speaker: "agent",
        text: expect.stringContaining("branzino"),
      }),
    ]);
    expect(completions).toEqual([
      expect.objectContaining({
        callId: "call_web_456",
        intent: "faq",
        outcome: "resolved",
        status: "resolved",
        summary: expect.stringContaining("Dana chatted with Olive & Ember"),
      }),
    ]);
  });

  it("carries service-business context into website chat instructions", async () => {
    const hvacContextStore: RestaurantContextStore = {
      async getContext() {
        return {
          ...demoRestaurantContext,
          businessLinks: [
            {
              kind: "booking" as const,
              label: "Book service",
              url: "https://summit.example/book",
            },
          ],
          businessType: "hvac",
          restaurantName: "Summit Air",
        };
      },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: "We can help with no heat. What town are you in?" }), {
        status: 200,
      }),
    );

    const service = createWebChatService(env, hvacContextStore);
    const result = await service.handleMessage({
      message: "What towns do you serve for no heat calls?",
      transcript: [],
    });

    expect(result.businessName).toBe("Summit Air");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.instructions).toContain("Business type: HVAC company");
    expect(body.instructions).toContain("service catalog");
    expect(body.instructions).toContain("Staff role is dispatcher");
    expect(body.instructions).toContain("service-area");
    expect(body.instructions).toContain("Book service");
  });

  it("requires a visitor message", async () => {
    const service = createWebChatService(env, contextStore);
    await expect(service.handleMessage({ message: "   " })).rejects.toThrow("message is required");
  });
});

function buildFakeCallStore(overrides: Partial<CallStore> = {}): CallStore {
  return {
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
      return {};
    },
    ...overrides,
  };
}
