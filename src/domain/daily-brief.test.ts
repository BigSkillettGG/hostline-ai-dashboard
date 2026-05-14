import { describe, expect, it } from "vitest";
import type { Call, Order, Reservation } from "@/data/mock";
import type { StaffTask } from "@/domain/staff-tasks";
import { buildDailyBrief } from "./daily-brief";

const now = new Date("2026-05-13T18:00:00.000Z");

const baseCall: Call = {
  caller: "Caller",
  confidence: 95,
  duration: 60,
  id: "call_1",
  intent: "faq",
  outcome: "resolved",
  phone: "+15555550123",
  status: "resolved",
  summary: "Caller asked about parking.",
  time: "2026-05-13T17:00:00.000Z",
  transcript: [],
};

const order: Order = {
  createdAt: "2026-05-13T16:00:00.000Z",
  customer: "Sam",
  etaMinutes: 20,
  id: "order_1",
  items: [],
  payAtPickup: true,
  phone: "+15555550123",
  status: "new",
  total: 53,
};

const reservation: Reservation = {
  createdAt: "2026-05-13T15:00:00.000Z",
  date: "2026-05-14",
  guest: "Alex",
  id: "res_1",
  partySize: 4,
  phone: "+15555550124",
  source: "ai_host",
  status: "pending",
  time: "19:00",
};

const task: StaffTask = {
  createdAt: "2026-05-13T17:30:00.000Z",
  id: "task_1",
  priority: "high",
  status: "open",
  title: "Call back catering lead",
  type: "customer_request",
};

describe("daily brief", () => {
  it("summarizes calls, revenue, bookings, and open work", () => {
    const brief = buildDailyBrief({
      businessName: "Olive & Ember",
      calls: [
        baseCall,
        {
          ...baseCall,
          caller: "Priya",
          id: "call_2",
          intent: "reservation",
          outcome: "message_taken",
          status: "new",
          summary: "Caller asked about catering for 45 guests and a private event buyout.",
        },
      ],
      now,
      orders: [order],
      reservations: [reservation],
      tasks: [task],
    });

    expect(brief.totals.calls).toBe(2);
    expect(brief.totals.orders).toBe(1);
    expect(brief.totals.reservations).toBe(1);
    expect(brief.totals.revenueCents).toBe(5300);
    expect(brief.totals.highValue).toBe(1);
    expect(brief.followUps.length).toBeGreaterThan(0);
    expect(brief.ownerMessage).toContain("Olive & Ember");
    expect(brief.ownerMessage).toContain("$53");
    expect(brief.copyText).toContain("SignalHost Daily Brief");
  });

  it("flags urgent risk and knowledge gaps", () => {
    const brief = buildDailyBrief({
      businessName: "Mike's Plumbing",
      calls: [{
        ...baseCall,
        confidence: 55,
        id: "call_risk",
        intent: "other",
        outcome: "unknown",
        status: "needs_review",
        summary: "Caller reported an active leak and Vera was not sure about the answer.",
      }],
      now,
      orders: [],
      reservations: [],
      tasks: [],
    });

    expect(brief.totals.urgent).toBe(1);
    expect(brief.totals.knowledgeGaps).toBe(1);
    expect(brief.headline).toContain("urgent");
    expect(brief.suggestedUpdates[0]?.title).toBe("Review or add missing knowledge");
  });

  it("uses vertical-specific report labels for trades", () => {
    const brief = buildDailyBrief({
      businessName: "BrightWire Electric",
      businessType: "electrical",
      calls: [{
        ...baseCall,
        id: "call_panel",
        intent: "reservation",
        summary: "Caller asked for an appointment for a panel upgrade estimate.",
      }],
      now,
      orders: [{ ...order, total: 0 }],
      reservations: [reservation],
      tasks: [],
    });

    expect(brief.metrics.map((metric) => metric.label)).toContain("Service requests");
    expect(brief.metrics.map((metric) => metric.label)).toContain("Appointments");
    expect(brief.ownerMessage).toContain("service request");
    expect(brief.ownerMessage).toContain("appointment request");
    expect(brief.copyText).toContain("- Service requests: 1");
    expect(brief.copyText).toContain("- Appointment requests: 1");
    expect(brief.copyText).not.toContain("Reservation requests");
  });

  it("ignores interactions outside the 24 hour window", () => {
    const brief = buildDailyBrief({
      businessName: "SignalHost Demo",
      calls: [{
        ...baseCall,
        id: "old_call",
        time: "2026-05-11T17:00:00.000Z",
      }],
      now,
      orders: [{ ...order, createdAt: "2026-05-11T17:00:00.000Z" }],
      reservations: [],
      tasks: [],
    });

    expect(brief.totals.calls).toBe(0);
    expect(brief.totals.orders).toBe(0);
    expect(brief.headline).toContain("No new customer interactions");
  });
});
