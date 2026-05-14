import { describe, expect, it } from "vitest";
import type { Call, Order, Reservation } from "@/data/mock";
import type { StaffTask } from "@/domain/staff-tasks";
import { buildOwnerAssistantResponse, classifyOwnerQuestion } from "./owner-assistant";

const now = new Date("2026-05-13T18:00:00.000Z");

const baseCall: Call = {
  caller: "Sarah",
  confidence: 95,
  duration: 90,
  id: "call_1",
  intent: "faq",
  outcome: "resolved",
  phone: "+15550100",
  status: "resolved",
  summary: "Caller asked about parking.",
  time: "2026-05-13T17:00:00.000Z",
  transcript: [],
};

const order: Order = {
  createdAt: "2026-05-13T16:30:00.000Z",
  customer: "Marco",
  etaMinutes: 25,
  id: "order_1",
  items: [],
  payAtPickup: true,
  phone: "+15550101",
  status: "new",
  total: 54,
};

const reservation: Reservation = {
  createdAt: "2026-05-13T16:10:00.000Z",
  date: "2026-05-14",
  guest: "Priya",
  id: "res_1",
  partySize: 6,
  phone: "+15550102",
  source: "ai_host",
  status: "pending",
  time: "18:00",
};

const urgentTask: StaffTask = {
  body: "Customer needs manager callback.",
  createdAt: "2026-05-13T17:45:00.000Z",
  id: "task_1",
  priority: "urgent",
  status: "open",
  title: "Manager callback",
  type: "manager_callback",
};

describe("owner assistant", () => {
  it("classifies common owner questions", () => {
    expect(classifyOwnerQuestion("What happened today?")).toBe("daily_summary");
    expect(classifyOwnerQuestion("Any urgent calls?")).toBe("urgent");
    expect(classifyOwnerQuestion("What needs follow up?")).toBe("follow_ups");
    expect(classifyOwnerQuestion("What questions did you not know?")).toBe("knowledge_gaps");
  });

  it("answers daily summary questions from operational data", () => {
    const response = buildOwnerAssistantResponse("What happened today?", {
      businessName: "Olive & Ember",
      calls: [baseCall],
      now,
      orders: [order],
      reservations: [reservation],
      tasks: [urgentTask],
    });

    expect(response.intent).toBe("daily_summary");
    expect(response.answer).toContain("Olive & Ember");
    expect(response.bullets).toContain("1 open follow-ups");
  });

  it("surfaces urgent calls and tasks", () => {
    const response = buildOwnerAssistantResponse("Any urgent calls?", {
      businessName: "Summit Air",
      calls: [{
        ...baseCall,
        confidence: 62,
        id: "call_urgent",
        intent: "other",
        outcome: "unknown",
        status: "needs_review",
        summary: "Caller has no heat in freezing weather and Vera was not sure.",
      }],
      now,
      orders: [],
      reservations: [],
      tasks: [urgentTask],
    });

    expect(response.intent).toBe("urgent");
    expect(response.answer).toContain("urgent");
    expect(response.bullets.join(" ")).toContain("Manager callback");
  });

  it("answers unknown questions with suggested prompts", () => {
    const response = buildOwnerAssistantResponse("Tell me something magical", {
      businessName: "SignalHost Demo",
      calls: [],
      now,
      orders: [],
      reservations: [],
      tasks: [],
    });

    expect(response.intent).toBe("unknown");
    expect(response.confidence).toBe("medium");
    expect(response.bullets[0]).toBe("What happened today?");
  });

  it("answers workflow questions with vertical-specific language", () => {
    const orderResponse = buildOwnerAssistantResponse("How many orders came in?", {
      businessName: "Summit Air",
      businessType: "hvac",
      calls: [],
      now,
      orders: [{ ...order, total: 0 }],
      reservations: [],
      tasks: [],
    });
    const bookingResponse = buildOwnerAssistantResponse("How many appointments?", {
      businessName: "RidgeLine Roofing",
      businessType: "roofing",
      calls: [],
      now,
      orders: [],
      reservations: [reservation],
      tasks: [],
    });

    expect(orderResponse.title).toBe("Service requests");
    expect(orderResponse.answer).toContain("service request");
    expect(orderResponse.answer).not.toContain("order");
    expect(bookingResponse.title).toBe("Inspections");
    expect(bookingResponse.answer).toContain("inspection request");
    expect(bookingResponse.answer).not.toContain("reservation");
  });
});
