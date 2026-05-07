import { describe, expect, it } from "vitest";
import { classifyEscalationIntent } from "./conversation-relay";

describe("conversation relay staff-review triggers", () => {
  it("classifies complaint and refund language as a complaint", () => {
    expect(classifyEscalationIntent("My order was wrong and I want a refund")).toBe("complaint");
    expect(classifyEscalationIntent("I need to talk to a manager about terrible service")).toBe("complaint");
    expect(classifyEscalationIntent("this is bullshit and useless")).toBe("complaint");
  });

  it("classifies direct human requests as handoffs", () => {
    expect(classifyEscalationIntent("Can a real person call me back?")).toBe("handoff");
    expect(classifyEscalationIntent("I need someone on staff")).toBe("handoff");
    expect(classifyEscalationIntent("Can I speak to a manager?")).toBe("handoff");
  });

  it("classifies special handling topics as low-confidence review", () => {
    expect(classifyEscalationIntent("Do you do catering for a corporate event?")).toBe("low_confidence");
    expect(classifyEscalationIntent("Can you guarantee this is safe for a peanut allergy?")).toBe("low_confidence");
    expect(classifyEscalationIntent("Can I bring wine for a large party?")).toBe("low_confidence");
  });

  it("classifies sales, delivery app, and lost-item calls", () => {
    expect(classifyEscalationIntent("I'm a linen vendor calling about your account")).toBe("sales");
    expect(classifyEscalationIntent("My DoorDash order was never delivered")).toBe("delivery_failure");
    expect(classifyEscalationIntent("I left my wallet there last night")).toBe("handoff");
  });

  it("ignores ordinary restaurant questions", () => {
    expect(classifyEscalationIntent("What time do you close tonight?")).toBeNull();
    expect(classifyEscalationIntent("Can I order a margherita pizza for pickup?")).toBeNull();
  });
});
