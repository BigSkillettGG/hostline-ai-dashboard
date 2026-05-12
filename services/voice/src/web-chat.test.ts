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
    expect(firstBody.tools.map((tool: { name: string }) => tool.name)).toContain("get_business_link");
  });

  it("creates a customer request when staff follow-up is needed", async () => {
    const createdRequests: unknown[] = [];
    const callStore = buildFakeCallStore({
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
        customerName: "Sam",
        customerPhone: "+15551234567",
        locationId: "loc_123",
        priority: "high",
        requestType: "service_appointment",
        summary: "Sam wants help with a leaking sink.",
      }),
    ]);
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
