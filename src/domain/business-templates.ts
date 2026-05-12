export type BusinessType =
  | "home_services"
  | "professional_services"
  | "restaurant"
  | "retail"
  | "salon_spa";

export interface BusinessTypeOption {
  label: string;
  value: BusinessType;
}

export interface BusinessTemplate {
  appointmentNoun: string;
  businessNoun: string;
  customerNoun: string;
  defaultName: string;
  defaultOffering: string;
  id: BusinessType;
  label: string;
  offeringNoun: string;
  staffNoun: string;
  workspaceLabel: string;
}

export const businessTypeOptions: BusinessTypeOption[] = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Home services / trades", value: "home_services" },
  { label: "Salon or spa", value: "salon_spa" },
  { label: "Professional services", value: "professional_services" },
  { label: "Retail or local shop", value: "retail" },
];

export const businessTemplates: Record<BusinessType, BusinessTemplate> = {
  home_services: {
    appointmentNoun: "appointment",
    businessNoun: "service business",
    customerNoun: "customer",
    defaultName: "Harbor Plumbing",
    defaultOffering: "Plumbing repairs, water heaters, leak detection, drains, and emergency service.",
    id: "home_services",
    label: "Home services / trades",
    offeringNoun: "service catalog",
    staffNoun: "dispatcher",
    workspaceLabel: "Home Services",
  },
  professional_services: {
    appointmentNoun: "consultation",
    businessNoun: "professional services firm",
    customerNoun: "client",
    defaultName: "Northstar Advisory",
    defaultOffering: "Consultations, intake calls, document collection, and client follow-up.",
    id: "professional_services",
    label: "Professional services",
    offeringNoun: "service list",
    staffNoun: "office team",
    workspaceLabel: "Professional Services",
  },
  restaurant: {
    appointmentNoun: "reservation",
    businessNoun: "restaurant",
    customerNoun: "guest",
    defaultName: "Olive & Ember",
    defaultOffering: "Neighborhood Italian restaurant with wood-fired pizza, handmade pasta, seasonal cocktails, and weekend brunch.",
    id: "restaurant",
    label: "Restaurant",
    offeringNoun: "menu",
    staffNoun: "staff",
    workspaceLabel: "Restaurant",
  },
  retail: {
    appointmentNoun: "visit",
    businessNoun: "local shop",
    customerNoun: "customer",
    defaultName: "Cedar & Finch",
    defaultOffering: "Product questions, availability checks, pickups, returns, and special orders.",
    id: "retail",
    label: "Retail or local shop",
    offeringNoun: "product catalog",
    staffNoun: "store team",
    workspaceLabel: "Retail",
  },
  salon_spa: {
    appointmentNoun: "appointment",
    businessNoun: "salon or spa",
    customerNoun: "client",
    defaultName: "Luna Studio",
    defaultOffering: "Haircuts, color, blowouts, facials, massage, packages, and product recommendations.",
    id: "salon_spa",
    label: "Salon or spa",
    offeringNoun: "service menu",
    staffNoun: "front desk",
    workspaceLabel: "Salon & Spa",
  },
};

export function normalizeBusinessType(value: unknown): BusinessType {
  if (typeof value !== "string") return "restaurant";
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized.includes("home") || normalized.includes("trade") || normalized.includes("plumb") || normalized.includes("hvac") || normalized.includes("electric")) {
    return "home_services";
  }
  if (normalized.includes("salon") || normalized.includes("spa") || normalized.includes("beauty") || normalized.includes("hair")) {
    return "salon_spa";
  }
  if (normalized.includes("professional") || normalized.includes("law") || normalized.includes("account") || normalized.includes("consult")) {
    return "professional_services";
  }
  if (normalized.includes("retail") || normalized.includes("shop") || normalized.includes("store")) {
    return "retail";
  }
  return "restaurant";
}

export function getBusinessTemplate(value: unknown): BusinessTemplate {
  return businessTemplates[normalizeBusinessType(value)];
}
