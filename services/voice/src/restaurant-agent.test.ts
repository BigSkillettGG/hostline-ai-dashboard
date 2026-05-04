import { describe, expect, it } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import { fallbackRestaurantReply } from "./restaurant-agent";

describe("restaurant fallback replies", () => {
  it("answers hours without an OpenAI key", () => {
    const reply = fallbackRestaurantReply("What time do you close?", demoRestaurantContext);
    expect(reply).toContain("Tuesday");
  });

  it("keeps allergy handling conservative", () => {
    const reply = fallbackRestaurantReply("Do you have gluten free food for a severe allergy?", demoRestaurantContext);
    expect(reply).toContain("staff confirmation");
  });
});
