export type BusinessType =
  | "electrical"
  | "hvac"
  | "plumbing"
  | "restaurant"
  | "roofing"
  | "salon_barber";

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
  { label: "Restaurants", value: "restaurant" },
  { label: "HVAC", value: "hvac" },
  { label: "Plumbers", value: "plumbing" },
  { label: "Roofers", value: "roofing" },
  { label: "Electricians", value: "electrical" },
  { label: "Hair salons and barbershops", value: "salon_barber" },
];

export const businessTemplates: Record<BusinessType, BusinessTemplate> = {
  electrical: {
    appointmentNoun: "appointment",
    businessNoun: "electrical contractor",
    customerNoun: "customer",
    defaultName: "BrightWire Electric",
    defaultOffering: "Electrical repairs, panel upgrades, EV chargers, generators, lighting, outlets, and urgent safety calls.",
    id: "electrical",
    label: "Electricians",
    offeringNoun: "service catalog",
    staffNoun: "dispatcher",
    workspaceLabel: "Electrical",
  },
  hvac: {
    appointmentNoun: "appointment",
    businessNoun: "HVAC company",
    customerNoun: "customer",
    defaultName: "Summit Air",
    defaultOffering: "Heating, cooling, tune-ups, emergency service, indoor air quality, and system replacement estimates.",
    id: "hvac",
    label: "HVAC",
    offeringNoun: "service catalog",
    staffNoun: "dispatcher",
    workspaceLabel: "HVAC",
  },
  plumbing: {
    appointmentNoun: "appointment",
    businessNoun: "plumbing company",
    customerNoun: "customer",
    defaultName: "Harbor Plumbing",
    defaultOffering: "Plumbing repairs, water heaters, leak detection, drains, fixture installs, and emergency service.",
    id: "plumbing",
    label: "Plumbers",
    offeringNoun: "service catalog",
    staffNoun: "dispatcher",
    workspaceLabel: "Plumbing",
  },
  restaurant: {
    appointmentNoun: "reservation",
    businessNoun: "restaurant",
    customerNoun: "guest",
    defaultName: "Olive & Ember",
    defaultOffering: "Neighborhood Italian restaurant with wood-fired pizza, handmade pasta, seasonal cocktails, and weekend brunch.",
    id: "restaurant",
    label: "Restaurants",
    offeringNoun: "menu",
    staffNoun: "staff",
    workspaceLabel: "Restaurant",
  },
  roofing: {
    appointmentNoun: "inspection",
    businessNoun: "roofing company",
    customerNoun: "homeowner",
    defaultName: "RidgeLine Roofing",
    defaultOffering: "Roof repairs, replacements, storm damage, inspections, gutters, skylights, and emergency tarping.",
    id: "roofing",
    label: "Roofers",
    offeringNoun: "service catalog",
    staffNoun: "office team",
    workspaceLabel: "Roofing",
  },
  salon_barber: {
    appointmentNoun: "appointment",
    businessNoun: "salon or barbershop",
    customerNoun: "client",
    defaultName: "Luna Studio",
    defaultOffering: "Haircuts, color, blowouts, barber services, treatments, product recommendations, and bridal appointments.",
    id: "salon_barber",
    label: "Hair salons and barbershops",
    offeringNoun: "service menu",
    staffNoun: "front desk",
    workspaceLabel: "Salon & Barber",
  },
};

export function normalizeBusinessType(value: unknown): BusinessType {
  if (typeof value !== "string") return "restaurant";
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized.includes("hvac") || normalized.includes("heating") || normalized.includes("cooling") || normalized.includes("air_condition")) {
    return "hvac";
  }
  if (normalized.includes("plumb") || normalized === "home_services" || normalized.includes("trade")) {
    return "plumbing";
  }
  if (normalized.includes("roof")) {
    return "roofing";
  }
  if (normalized.includes("electric")) {
    return "electrical";
  }
  if (normalized.includes("salon") || normalized.includes("spa") || normalized.includes("beauty") || normalized.includes("hair") || normalized.includes("barber")) {
    return "salon_barber";
  }
  return "restaurant";
}

export function getBusinessTemplate(value: unknown): BusinessTemplate {
  return businessTemplates[normalizeBusinessType(value)];
}
