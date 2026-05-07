import { afterEach, describe, expect, it, vi } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import {
  buildConversationInput,
  buildRestaurantInstructions,
  fallbackRestaurantReply,
  generateCallSummary,
  generateRestaurantReply,
} from "./restaurant-agent";

describe("restaurant fallback replies", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers hours without an OpenAI key", () => {
    const reply = fallbackRestaurantReply("What time do you close?", demoRestaurantContext);
    expect(reply).toContain("Tuesday");
  });

  it("keeps allergy handling conservative", () => {
    const reply = fallbackRestaurantReply("Do you have gluten free food for a severe allergy?", demoRestaurantContext);
    expect(reply).toContain("staff confirmation");
  });

  it("answers configured FAQs when no model is available", () => {
    const reply = fallbackRestaurantReply("Can I bring a birthday cake?", demoRestaurantContext);
    expect(reply).toContain("plating fee");
  });

  it("answers configured knowledge sections when no model is available", () => {
    const reply = fallbackRestaurantReply("Do you do private events?", demoRestaurantContext);
    expect(reply).toContain("events manager");
  });

  it("includes FAQs and knowledge sections in model instructions", () => {
    const instructions = buildRestaurantInstructions(demoRestaurantContext);
    expect(instructions).toContain("FAQs: Q: Do you sell gift cards?");
    expect(instructions).toContain("Knowledge sections: Private events");
  });

  it("coaches the model for noisy calls and rude callers", () => {
    const instructions = buildRestaurantInstructions(demoRestaurantContext);
    expect(instructions).toContain("noisy phone audio");
    expect(instructions).toContain("If a caller is rude");
  });

  it("passes structured conversation turns to the Responses API", () => {
    const input = buildConversationInput("Do you have patio seating?", [
      {
        at: "2026-05-06T20:00:00.000Z",
        role: "caller",
        text: "Hi",
      },
      {
        at: "2026-05-06T20:00:01.000Z",
        role: "agent",
        text: "Thanks for calling Olive & Ember. How can I help?",
      },
    ]);

    expect(input).toEqual([
      { content: "Hi", role: "user" },
      { content: "Thanks for calling Olive & Ember. How can I help?", role: "assistant" },
      { content: "Do you have patio seating?", role: "user" },
    ]);
  });

  it("does not duplicate the current caller turn when it is already persisted", () => {
    const input = buildConversationInput("Do you have patio seating?", [
      {
        at: "2026-05-06T20:00:00.000Z",
        role: "caller",
        text: "Do you have patio seating?",
      },
    ]);

    expect(input).toEqual([{ content: "Do you have patio seating?", role: "user" }]);
  });

  it("uses the fast playbook before calling OpenAI", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const reply = await generateRestaurantReply({
      callerUtterance: "I left my wallet there last night",
      context: demoRestaurantContext,
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5-mini",
        OPENAI_REPLY_TIMEOUT_MS: 4500,
      },
      transcript: [],
    });

    expect(reply).toContain("What item was lost");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a larger reply budget for longer confirmations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: "Sure, I can help with that." }), { status: 200 }),
    );

    await generateRestaurantReply({
      callerUtterance: "Can you tell me about the patio?",
      context: demoRestaurantContext,
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5-mini",
        OPENAI_REPLY_TIMEOUT_MS: 4500,
      },
      transcript: [],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.max_output_tokens).toBe(220);
    expect(body.input).toEqual([{ content: "Can you tell me about the patio?", role: "user" }]);
  });

  it("executes one Responses API function-call round before returning the final reply", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: [
              {
                arguments: "{\"topic\":\"parking\"}",
                call_id: "call_1",
                name: "lookup_policy",
                type: "function_call",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output_text: "There is metered parking nearby." }), { status: 200 }),
      );

    const reply = await generateRestaurantReply({
      callerUtterance: "Can you help me with arrival details?",
      context: demoRestaurantContext,
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5-mini",
        OPENAI_REPLY_TIMEOUT_MS: 4500,
      },
      handleToolCall: async (toolCall) => ({
        policy: `${toolCall.arguments.topic}: metered parking nearby`,
      }),
      tools: [
        {
          description: "Lookup policy.",
          name: "lookup_policy",
          parameters: { type: "object" },
          type: "function",
        },
      ],
      transcript: [],
    });

    expect(reply).toBe("There is metered parking nearby.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(secondBody.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          call_id: "call_1",
          output: "{\"policy\":\"parking: metered parking nearby\"}",
          type: "function_call_output",
        }),
      ]),
    );
  });

  it("can generate an LLM-assisted staff call summary", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: "Caller placed a pickup order and asked for staff confirmation." }), {
        status: 200,
      }),
    );

    const summary = await generateCallSummary({
      context: demoRestaurantContext,
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5-mini",
        OPENAI_REPLY_TIMEOUT_MS: 4500,
      },
      structuredSummary: "Pickup order submitted.",
      transcript: [
        {
          at: "2026-05-06T20:00:00.000Z",
          role: "caller",
          text: "I want two pizzas for pickup.",
        },
        {
          at: "2026-05-06T20:00:02.000Z",
          role: "agent",
          text: "I sent that to staff.",
        },
      ],
    });

    expect(summary).toBe("Caller placed a pickup order and asked for staff confirmation.");
  });
});
