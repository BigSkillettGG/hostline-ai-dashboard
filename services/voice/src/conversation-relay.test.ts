import { describe, expect, it } from "vitest";
import {
  appendCompletedActionFollowUp,
  buildLatencyFiller,
  classifyEscalationIntent,
  sendText,
  summarizeCallForStaff,
} from "./conversation-relay";

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

  it("summarizes structured call outcomes for staff review", () => {
    const summary = summarizeCallForStaff({
      needsStaffReview: true,
      orderCreatedId: "order_1",
      orderCustomerName: "Priya Shah",
      orderDraftItems: [
        { name: "Margherita Pizza", priceCents: 1800, quantity: 2 },
        { name: "Caesar Salad", priceCents: 1400, quantity: 1 },
      ],
      staffTaskIntents: ["complaint"],
      transcript: [
        {
          at: "2026-05-06T20:00:00.000Z",
          role: "caller",
          text: "I need two margherita pizzas and a caesar salad for pickup.",
        },
        {
          at: "2026-05-06T20:00:05.000Z",
          role: "caller",
          text: "Name is Priya Shah.",
        },
      ],
    });

    expect(summary).toContain("Pickup order submitted for Priya Shah");
    expect(summary).toContain("2 Margherita Pizza, 1 Caesar Salad");
    expect(summary).toContain("$50.00");
    expect(summary).toContain("Staff follow-up flagged: complaint");
  });

  it("asks what else it can help with after completed action confirmations", () => {
    expect(appendCompletedActionFollowUp("I have sent that reservation request to staff.")).toBe(
      "I have sent that reservation request to staff. Anything else I can help you with?",
    );
    expect(
      appendCompletedActionFollowUp(
        "I have sent that pickup order to the staff review queue. Anything else I can help you with?",
      ),
    ).toBe("I have sent that pickup order to the staff review queue. Anything else I can help you with?");
  });

  it("chooses short human filler phrases for slower live turns", () => {
    expect(buildLatencyFiller("Do you have availability for a reservation at six?")).toBe(
      "Let me check that for you.",
    );
    expect(buildLatencyFiller("Can I order a pizza for pickup?")).toBe("Let me pull that up for you.");
    expect(buildLatencyFiller("Do you have anything gluten free?")).toBe(
      "One moment while I check that carefully.",
    );
  });

  it("can stream a filler phrase before the final ConversationRelay answer", () => {
    const sent: unknown[] = [];
    const ws = {
      send(raw: string) {
        sent.push(JSON.parse(raw));
      },
    };

    sendText(ws as never, "Let me check that for you.", "en-US", { last: false });

    expect(sent).toEqual([
      {
        interruptible: true,
        lang: "en-US",
        last: false,
        preemptible: true,
        token: "Let me check that for you.",
        type: "text",
      },
    ]);
  });
});
