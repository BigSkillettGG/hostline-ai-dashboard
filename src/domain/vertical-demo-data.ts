import type { Call, Order, Reservation } from "@/data/mock";
import { normalizeBusinessType, type BusinessType } from "./business-templates";

type DemoScenario = Pick<Call, "confidence" | "intent" | "outcome" | "status" | "summary">;

const demoScenarios: Record<Exclude<BusinessType, "restaurant">, DemoScenario[]> = {
  electrical: [
    scenario("other", "manager_alerted", "needs_review", "Caller reported a burning smell near the panel and needs an urgent electrician callback.", 86),
    scenario("order", "message_taken", "new", "Customer requested an EV charger estimate and shared garage access notes.", 91),
    scenario("reservation", "resolved", "resolved", "Caller asked for an appointment for recessed lighting and received the booking link.", 94),
    scenario("faq", "resolved", "resolved", "Caller asked whether BrightWire is licensed, insured, and handles permits.", 96),
    scenario("complaint", "manager_alerted", "needs_review", "Customer reported a missed technician arrival window and asked for manager follow-up.", 78),
    scenario("sales", "message_taken", "reviewed", "Electrical supplier called about a new fixture line. Message logged for the owner.", 88),
  ],
  hvac: [
    scenario("other", "manager_alerted", "needs_review", "Caller reported no heat in freezing weather and needs urgent dispatch review.", 87),
    scenario("order", "message_taken", "new", "Customer requested a system replacement estimate and asked about financing.", 92),
    scenario("reservation", "resolved", "resolved", "Caller asked for an AC tune-up appointment and received the booking link.", 94),
    scenario("faq", "resolved", "resolved", "Caller asked about maintenance plans, filter changes, and service area.", 96),
    scenario("complaint", "manager_alerted", "needs_review", "Customer said the unit still is not cooling after a recent visit and wants manager follow-up.", 79),
    scenario("sales", "message_taken", "reviewed", "Equipment vendor called about a parts promotion. Message logged for the office.", 88),
  ],
  plumbing: [
    scenario("other", "manager_alerted", "needs_review", "Caller reported water coming through the ceiling and needs urgent dispatch review.", 88),
    scenario("order", "message_taken", "new", "Customer requested a water heater replacement estimate and shared tank details.", 93),
    scenario("reservation", "resolved", "resolved", "Caller asked for a drain-clearing appointment and received the booking link.", 95),
    scenario("faq", "resolved", "resolved", "Caller asked about trip fees, emergency pricing, and service area.", 96),
    scenario("complaint", "manager_alerted", "needs_review", "Customer reported a leak returned after service and asked for manager follow-up.", 80),
    scenario("sales", "message_taken", "reviewed", "Supply rep called about fixture inventory. Message logged for the office.", 88),
  ],
  roofing: [
    scenario("other", "manager_alerted", "needs_review", "Caller reported an active interior leak after a storm and needs urgent office follow-up.", 86),
    scenario("order", "message_taken", "new", "Homeowner requested a roof replacement estimate and asked about financing.", 93),
    scenario("reservation", "resolved", "resolved", "Caller asked for a roof inspection and received the inspection request link.", 94),
    scenario("faq", "resolved", "resolved", "Caller asked about insurance claims, photo uploads, and storm-response timing.", 95),
    scenario("complaint", "manager_alerted", "needs_review", "Customer reported gutter work was incomplete and asked for manager follow-up.", 78),
    scenario("sales", "message_taken", "reviewed", "Material vendor called about shingle availability. Message logged for the office.", 88),
  ],
  salon_barber: [
    scenario("reservation", "resolved", "resolved", "Client asked for a same-day haircut and received the booking link.", 95),
    scenario("order", "message_taken", "new", "Client requested a color consultation and shared color history for front-desk follow-up.", 92),
    scenario("faq", "resolved", "resolved", "Caller asked about balayage starting prices, deposits, and cancellation policy.", 95),
    scenario("other", "message_taken", "new", "Client asked about product availability and gift cards. Front desk follow-up requested.", 90),
    scenario("complaint", "manager_alerted", "needs_review", "Client asked for a redo after a color service and needs manager review.", 80),
    scenario("sales", "message_taken", "reviewed", "Product rep called about education dates. Message logged for the owner.", 88),
  ],
};

export function adaptDemoDataForBusiness({
  businessType,
  calls,
  orders,
  reservations,
}: {
  businessType: unknown;
  calls: Call[];
  orders: Order[];
  reservations: Reservation[];
}) {
  const normalized = normalizeBusinessType(businessType);
  if (normalized === "restaurant") return { calls, orders, reservations };

  return {
    calls: adaptCalls(calls, normalized),
    orders: adaptOrders(orders, normalized),
    reservations: adaptReservations(reservations, normalized),
  };
}

function adaptCalls(calls: Call[], businessType: Exclude<BusinessType, "restaurant">): Call[] {
  const scenarios = demoScenarios[businessType];

  return calls.map((call, index) => {
    const selected = scenarios[index % scenarios.length];
    return {
      ...call,
      ...selected,
    };
  });
}

function adaptOrders(orders: Order[], businessType: Exclude<BusinessType, "restaurant">): Order[] {
  return orders.map((order, index) => ({
    ...order,
    etaMinutes: 0,
    items: [],
    notes: requestNote(businessType, index),
    payAtPickup: false,
    total: 0,
  }));
}

function adaptReservations(reservations: Reservation[], businessType: Exclude<BusinessType, "restaurant">): Reservation[] {
  return reservations.map((reservation, index) => ({
    ...reservation,
    notes: bookingNote(businessType, index),
    partySize: 1,
  }));
}

function scenario(
  intent: Call["intent"],
  outcome: Call["outcome"],
  status: Call["status"],
  summary: string,
  confidence: number,
): DemoScenario {
  return {
    confidence,
    intent,
    outcome,
    status,
    summary,
  };
}

function requestNote(businessType: Exclude<BusinessType, "restaurant">, index: number) {
  const notes: Record<Exclude<BusinessType, "restaurant">, string[]> = {
    electrical: ["EV charger estimate", "Panel upgrade request", "Lighting install request"],
    hvac: ["System replacement estimate", "Maintenance plan interest", "No-heat service request"],
    plumbing: ["Water heater estimate", "Leak repair request", "Drain clearing request"],
    roofing: ["Roof replacement estimate", "Storm repair request", "Emergency tarping request"],
    salon_barber: ["Color consultation request", "Haircut booking request", "Bridal service inquiry"],
  };

  return notes[businessType][index % notes[businessType].length];
}

function bookingNote(businessType: Exclude<BusinessType, "restaurant">, index: number) {
  const notes: Record<Exclude<BusinessType, "restaurant">, string[]> = {
    electrical: ["Appointment request for electrical diagnosis", "EV charger consult", "Lighting install visit"],
    hvac: ["Tune-up appointment request", "Replacement estimate visit", "No-AC callback request"],
    plumbing: ["Plumbing appointment request", "Water heater visit", "Drain service visit"],
    roofing: ["Roof inspection request", "Storm damage inspection", "Gutter inspection"],
    salon_barber: ["Haircut booking request", "Color consultation", "Barber appointment"],
  };

  return notes[businessType][index % notes[businessType].length];
}
