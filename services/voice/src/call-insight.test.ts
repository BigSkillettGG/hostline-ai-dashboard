import { describe, expect, it } from "vitest";
import { buildPersistedCallInsightPatch } from "./call-insight";

describe("call insight persistence", () => {
  it("marks resolved routine orders as revenue opportunities without follow-up", () => {
    const patch = buildPersistedCallInsightPatch({
      intent: "order",
      orderId: "order_uuid",
      outcome: "order_placed",
      status: "resolved",
      summary: "Pickup order placed and routed to staff review.",
    });

    expect(patch).toMatchObject({
      follow_up_needed: false,
      knowledge_gap: false,
      owner_report_bucket: "revenue_opportunity",
      urgency: "normal",
      value_tier: "medium",
      workflow_status: "resolved",
    });
    expect(patch.tags).toContain("order");
  });

  it("marks allergy and unknown-answer calls for urgent review", () => {
    const patch = buildPersistedCallInsightPatch({
      confidence: 61,
      intent: "faq",
      outcome: "escalated",
      status: "needs_review",
      summary: "Caller asked about a severe peanut allergy. SignalHost said staff needs to confirm and someone will call back.",
    });

    expect(patch.follow_up_needed).toBe(true);
    expect(patch.knowledge_gap).toBe(true);
    expect(patch.owner_report_bucket).toBe("risk_or_complaint");
    expect(patch.urgency).toBe("urgent");
    expect(patch.value_tier).toBe("risk");
    expect(patch.workflow_status).toBe("escalated");
    expect(patch.tags).toEqual(expect.arrayContaining(["follow-up", "knowledge gap", "risk", "urgent"]));
  });

  it("marks staff-confirmed reservation requests as open follow-up without a knowledge gap", () => {
    const patch = buildPersistedCallInsightPatch({
      confidence: 88,
      intent: "reservation",
      outcome: "message_taken",
      reservationId: "reservation_uuid",
      status: "resolved",
      summary: "Reservation request saved. Staff will confirm it shortly.",
    });

    expect(patch).toMatchObject({
      follow_up_needed: true,
      knowledge_gap: false,
      owner_report_bucket: "open_follow_up",
      recommended_action: "Confirm the reservation or request status.",
      urgency: "high",
      value_tier: "medium",
      workflow_status: "needs_follow_up",
    });
  });
});
