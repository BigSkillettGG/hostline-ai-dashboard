export type BusinessLinkKind =
  | "booking"
  | "custom"
  | "intake"
  | "menu"
  | "ordering"
  | "quote"
  | "reservation";

export interface BusinessLink {
  description?: string;
  kind: BusinessLinkKind;
  label: string;
  url: string;
}

export type CustomerRequestKind =
  | "callback"
  | "complaint"
  | "general"
  | "lead"
  | "order"
  | "quote"
  | "reservation"
  | "service_appointment";

export const businessLinkKindLabels: Record<BusinessLinkKind, string> = {
  booking: "Booking link",
  custom: "Custom link",
  intake: "Intake form",
  menu: "Menu link",
  ordering: "Online ordering link",
  quote: "Quote request link",
  reservation: "Reservation link",
};

export function normalizeBusinessLinkKind(value: unknown): BusinessLinkKind | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("order")) return "ordering";
  if (normalized.includes("reservation")) return "reservation";
  if (normalized.includes("book") || normalized.includes("appointment")) return "booking";
  if (normalized.includes("quote") || normalized.includes("estimate")) return "quote";
  if (normalized.includes("intake") || normalized.includes("form")) return "intake";
  if (normalized.includes("menu")) return "menu";
  if (normalized.includes("custom") || normalized.includes("other")) return "custom";
  return undefined;
}

export function normalizeCustomerRequestKind(value: unknown): CustomerRequestKind {
  if (typeof value !== "string") return "general";
  const normalized = value.toLowerCase();
  if (normalized.includes("reservation")) return "reservation";
  if (normalized.includes("order")) return "order";
  if (normalized.includes("service") || normalized.includes("appointment") || normalized.includes("booking")) {
    return "service_appointment";
  }
  if (normalized.includes("quote") || normalized.includes("estimate")) return "quote";
  if (normalized.includes("lead")) return "lead";
  if (normalized.includes("complaint")) return "complaint";
  if (normalized.includes("callback") || normalized.includes("call back")) return "callback";
  return "general";
}

export function findBusinessLink(links: BusinessLink[], kind: unknown) {
  const normalizedKind = normalizeBusinessLinkKind(kind);
  if (!normalizedKind) return undefined;
  return links.find((link) => link.kind === normalizedKind);
}
