import { describe, expect, it } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import { buildRestaurantInstructions, fallbackRestaurantReply } from "./restaurant-agent";

describe("restaurant fallback replies", () => {
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
});
