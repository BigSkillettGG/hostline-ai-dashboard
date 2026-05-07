import { afterEach, describe, expect, it, vi } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import { buildRestaurantInstructions, fallbackRestaurantReply, generateRestaurantReply } from "./restaurant-agent";

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
});
