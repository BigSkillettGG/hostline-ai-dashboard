import {
  getBusinessTemplate,
  normalizeBusinessType,
  type BusinessTemplate,
  type BusinessType,
} from "../../../src/domain/business-templates";
import type { RestaurantVoiceContext } from "./restaurant-context";

interface VerticalRuntimeCopy {
  commonIntents: string[];
  customerRequestExamples: string[];
  safetyLine: string;
  serviceRequestLine: string;
  speechStyleLine: string;
}

export interface RuntimeBusinessProfile {
  appointmentNoun: string;
  businessNoun: string;
  businessType: BusinessType;
  commonIntents: string[];
  customerNoun: string;
  customerRequestExamples: string[];
  isRestaurant: boolean;
  offeringNoun: string;
  safetyLine: string;
  serviceRequestLine: string;
  speechStyleLine: string;
  staffNoun: string;
  template: BusinessTemplate;
}

const verticalRuntimeCopy: Record<BusinessType, VerticalRuntimeCopy> = {
  electrical: {
    commonIntents: [
      "panel upgrades",
      "breaker issues",
      "outlet repairs",
      "EV chargers",
      "generators",
      "lighting",
      "sparking",
      "burning smells",
      "permits",
      "estimates",
      "service area",
    ],
    customerRequestExamples: [
      "panel or breaker issue",
      "EV charger estimate",
      "lighting install",
      "urgent safety callback",
    ],
    safetyLine:
      "Electrical safety calls are high-trust moments: never give DIY repair instructions, and escalate sparking, shocks, burning smells, exposed wiring, or panel concerns for urgent staff follow-up.",
    serviceRequestLine:
      "For electrical requests, collect the issue, property type, address or service area, urgency, access notes, customer name, callback number, and preferred window.",
    speechStyleLine:
      "Use calm, competent dispatcher language. Be especially careful and reassuring around safety-sensitive electrical concerns.",
  },
  hvac: {
    commonIntents: [
      "no heat",
      "no AC",
      "furnace",
      "boiler",
      "heat pump",
      "thermostat",
      "filters",
      "tune-ups",
      "maintenance",
      "emergency service",
      "replacement estimates",
      "service area",
    ],
    customerRequestExamples: [
      "no heat call",
      "AC repair",
      "maintenance tune-up",
      "replacement estimate",
    ],
    safetyLine:
      "HVAC safety calls need care: gas smell, carbon monoxide alarms, no heat in freezing weather, or vulnerable occupants should be treated as urgent staff callback cases.",
    serviceRequestLine:
      "For HVAC requests, collect heating or cooling issue, equipment type if known, address or service area, urgency, customer name, callback number, and preferred service window.",
    speechStyleLine:
      "Use friendly dispatcher language. Sound quick, practical, and reassuring when someone has no heat, no AC, or an urgent comfort issue.",
  },
  plumbing: {
    commonIntents: [
      "leaks",
      "burst pipes",
      "drains",
      "clogs",
      "toilets",
      "sinks",
      "water heaters",
      "sewer lines",
      "shutoff valves",
      "emergency service",
      "estimates",
      "service area",
    ],
    customerRequestExamples: [
      "active leak",
      "clogged drain",
      "water heater issue",
      "fixture install",
    ],
    safetyLine:
      "Plumbing emergencies need urgency: active leaks, burst pipes, sewage backups, no water, and water-heater safety concerns should be escalated for fast staff follow-up.",
    serviceRequestLine:
      "For plumbing requests, collect the issue, whether water is actively leaking, fixture or area affected, address or service area, urgency, customer name, callback number, and preferred window.",
    speechStyleLine:
      "Use practical, calm front-desk language. Be direct about emergencies and avoid over-promising exact arrival times.",
  },
  restaurant: {
    commonIntents: [
      "reservations",
      "pickup orders",
      "specials",
      "menu",
      "happy hour",
      "parking",
      "allergies",
      "delivery drivers",
      "hours",
      "waitlist",
      "private events",
    ],
    customerRequestExamples: [
      "pickup order",
      "reservation",
      "menu question",
      "allergy or staff callback",
    ],
    safetyLine:
      "Severe allergies require staff confirmation because cross-contact is possible. Never guarantee allergy safety.",
    serviceRequestLine:
      "For restaurant requests, collect only the details needed for the order, reservation, event inquiry, or staff callback.",
    speechStyleLine:
      "Use polished restaurant-host language. Sound warm, lightly upbeat, calm under pressure, and efficient.",
  },
  roofing: {
    commonIntents: [
      "roof leak",
      "storm damage",
      "inspection",
      "replacement estimate",
      "shingles",
      "metal roof",
      "gutters",
      "skylights",
      "emergency tarping",
      "insurance",
      "service area",
    ],
    customerRequestExamples: [
      "roof inspection",
      "storm damage estimate",
      "active leak",
      "emergency tarp request",
    ],
    safetyLine:
      "Roofing emergencies include active leaks, storm damage, fallen limbs, and urgent tarping. Do not advise callers to climb onto roofs.",
    serviceRequestLine:
      "For roofing requests, collect the issue, property address or service area, storm or leak details, urgency, customer name, callback number, and preferred inspection window.",
    speechStyleLine:
      "Use calm office-team language. Be reassuring after storms while avoiding guaranteed insurance, price, or schedule promises.",
  },
  salon_barber: {
    commonIntents: [
      "appointments",
      "haircuts",
      "color",
      "blowouts",
      "barber services",
      "beard trims",
      "stylists",
      "consultations",
      "deposits",
      "cancellations",
      "product questions",
      "bridal services",
    ],
    customerRequestExamples: [
      "haircut appointment",
      "color consultation",
      "barber service",
      "bridal inquiry",
    ],
    safetyLine:
      "For color, chemical services, skin sensitivities, allergies, or complex corrections, avoid guarantees and route uncertain questions to the front desk or stylist.",
    serviceRequestLine:
      "For salon or barbershop requests, collect service type, preferred provider if any, desired date and time, client name, callback number, and relevant hair or service notes.",
    speechStyleLine:
      "Use polished front-desk language. Sound warm, stylish, efficient, and careful with appointment availability.",
  },
};

export function getRuntimeBusinessProfile(context: Pick<RestaurantVoiceContext, "businessType">): RuntimeBusinessProfile {
  const businessType = normalizeBusinessType(context.businessType);
  const template = getBusinessTemplate(businessType);
  const copy = verticalRuntimeCopy[businessType];

  return {
    appointmentNoun: template.appointmentNoun,
    businessNoun: template.businessNoun,
    businessType,
    commonIntents: copy.commonIntents,
    customerNoun: template.customerNoun,
    customerRequestExamples: copy.customerRequestExamples,
    isRestaurant: businessType === "restaurant",
    offeringNoun: template.offeringNoun,
    safetyLine: copy.safetyLine,
    serviceRequestLine: copy.serviceRequestLine,
    speechStyleLine: copy.speechStyleLine,
    staffNoun: template.staffNoun,
    template,
  };
}

export function buildBusinessTranscriptionPrompt(context: RestaurantVoiceContext) {
  const profile = getRuntimeBusinessProfile(context);
  const offeringTerms = context.menuHighlights.slice(0, 16).join(", ");
  return [
    `This is a phone call with ${context.restaurantName}, a ${profile.businessNoun}.`,
    `Expect ${profile.businessNoun} words: ${profile.commonIntents.join(", ")}.`,
    offeringTerms && `${capitalize(profile.offeringNoun)} terms include: ${offeringTerms}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
