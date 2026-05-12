import { afterEach, describe, expect, it, vi } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import {
  buildConversationInput,
  buildReservationClarifyingReply,
  buildRestaurantInstructions,
  fallbackRestaurantReply,
  generateCallSummary,
  generateRestaurantReply,
  withConversationalFollowUp,
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
    expect(instructions).toContain("Do not repeat the opening greeting");
    expect(instructions).toContain("Anything else I can help you with?");
  });

  it("coaches a warmer host personality without becoming theatrical", () => {
    const instructions = buildRestaurantInstructions(demoRestaurantContext);

    expect(instructions).toContain("polished restaurant host");
    expect(instructions).toContain("Do not sound like an IVR");
    expect(instructions).toContain("Use contractions and plain restaurant language");
    expect(instructions).toContain("Match the emotional temperature");
    expect(instructions).toContain("Do not be funny, sassy, flirty, theatrical, or overly chatty");
  });

  it("adapts model instructions for non-restaurant businesses", () => {
    const instructions = buildRestaurantInstructions({
      ...demoRestaurantContext,
      businessType: "plumbing",
      restaurantName: "Harbor Plumbing",
    });

    expect(instructions).toContain("polished front-desk host");
    expect(instructions).toContain("Use the full business context");
    expect(instructions).toContain("Offerings and service highlights");
    expect(instructions).toContain("out-of-scope requests");
  });

  it("coaches the model not to address callers by a bare last name", () => {
    const instructions = buildRestaurantInstructions(demoRestaurantContext);

    expect(instructions).toContain("Name etiquette for orders and reservations");
    expect(instructions).toContain("not 'Thanks, Schneider.'");
    expect(instructions).toContain("Do not infer Mr., Ms., or Mrs. from the sound of the caller's voice");
    expect(instructions).toContain("Use an honorific only if the caller says it");
  });

  it("prevents fake live transfers and over-promising substitutions", () => {
    const instructions = buildRestaurantInstructions(demoRestaurantContext);

    expect(instructions).toContain("There is no live staff transfer");
    expect(instructions).toContain("Never say you are connecting, transferring, or placing the caller on hold");
    expect(instructions).toContain("substitutions and off-menu requests");
    expect(instructions).toContain("do not guarantee availability, price, or allergy safety");
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
        text: "Thanks for calling Olive & Ember. How can I help you?",
      },
    ]);

    expect(input).toEqual([
      { content: "Hi", role: "user" },
      { content: "Thanks for calling Olive & Ember. How can I help you?", role: "assistant" },
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

  it("lets the model handle normal context questions instead of single-keyword playbook replies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: "Tonight's special is the mushroom risotto." }), { status: 200 }),
    );

    const reply = await generateRestaurantReply({
      callerUtterance: "Do you have any specials tonight?",
      context: demoRestaurantContext,
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5-mini",
        OPENAI_REPLY_TIMEOUT_MS: 4500,
      },
      transcript: [],
    });

    expect(reply).toBe("Tonight's special is the mushroom risotto. Anything else I can help you with?");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks only for the missing reservation detail when the caller already gave a time", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const reply = await generateRestaurantReply({
      callerUtterance: "Do you have availability for a reservation at 6pm tonight?",
      context: demoRestaurantContext,
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5-mini",
        OPENAI_REPLY_TIMEOUT_MS: 4500,
      },
      transcript: [],
    });

    expect(reply).toBe("For 6 tonight, sure. How many people should I check for?");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps reservation context across short follow-up turns", () => {
    const reply = buildReservationClarifyingReply("Two", [
      {
        at: "2026-05-06T20:00:00.000Z",
        role: "caller",
        text: "Do you have availability for a reservation at 6pm tonight?",
      },
      {
        at: "2026-05-06T20:00:01.000Z",
        role: "agent",
        text: "For 6 tonight, sure. How many people should I check for?",
      },
    ]);

    expect(reply).toBeNull();
  });

  it("adds a light follow-up after simple informational answers", () => {
    expect(withConversationalFollowUp("We have metered parking nearby.", "Where can I park?")).toBe(
      "We have metered parking nearby. Anything else I can help you with?",
    );
  });

  it("does not add a generic follow-up when Vera already asked a specific question", () => {
    expect(
      withConversationalFollowUp(
        "I can help with a pickup order. What would you like?",
        "I want to place an order",
      ),
    ).toBe("I can help with a pickup order. What would you like?");
  });

  it("does add the follow-up after completed reservation or order confirmations", () => {
    expect(withConversationalFollowUp("I have sent that reservation request to staff.", "Book a table for four.")).toBe(
      "I have sent that reservation request to staff. Anything else I can help you with?",
    );
    expect(withConversationalFollowUp("I have sent that pickup order to staff.", "That's all for my pickup order.")).toBe(
      "I have sent that pickup order to staff. Anything else I can help you with?",
    );
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

    expect(reply).toBe("There is metered parking nearby. Anything else I can help you with?");
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
