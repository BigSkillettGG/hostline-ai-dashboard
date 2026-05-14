import { getBusinessTemplate, normalizeBusinessType, type BusinessType } from "./business-templates";

export interface VerticalWorkflowLabel {
  activityTitle: string;
  copyLabel: string;
  metricLabel: string;
  ownerPhrase: string;
  plural: string;
  singular: string;
}

export interface VerticalInsightProfile {
  appointmentNoun: string;
  businessType: BusinessType;
  dashboard: {
    staffFollowUpsLabel: string;
    topIntentSubtitle: string;
  };
  firstCallChecks: string[];
  highValueLabel: string;
  primaryWorkflow: VerticalWorkflowLabel;
  secondaryWorkflow: VerticalWorkflowLabel;
  serviceAreaLabel: string;
  vendorMetricLabel: string;
}

export const verticalInsightProfiles: Record<BusinessType, VerticalInsightProfile> = {
  electrical: {
    appointmentNoun: "appointment",
    businessType: "electrical",
    dashboard: {
      staffFollowUpsLabel: "Needs dispatch",
      topIntentSubtitle: "What customers needed",
    },
    firstCallChecks: [
      "Emergency electrical safety calls",
      "EV charger and panel-upgrade estimates",
      "Service-area and permit questions",
      "Existing job, warranty, and invoice follow-ups",
      "Vendor, hiring, and sales calls",
    ],
    highValueLabel: "High-value electrical opportunities",
    primaryWorkflow: workflow("service request", "service requests", "Service requests", "Service requests", "service request", "New service request"),
    secondaryWorkflow: workflow("appointment", "appointments", "Appointments", "Appointment requests", "appointment request", "Appointment request"),
    serviceAreaLabel: "Service area",
    vendorMetricLabel: "Vendor / sales calls",
  },
  hvac: {
    appointmentNoun: "appointment",
    businessType: "hvac",
    dashboard: {
      staffFollowUpsLabel: "Needs dispatch",
      topIntentSubtitle: "What customers needed",
    },
    firstCallChecks: [
      "No heat, no AC, gas smell, and urgent comfort calls",
      "Tune-up, maintenance-plan, and replacement inquiries",
      "Brand, warranty, filter, and thermostat questions",
      "Service-area, travel-fee, and financing questions",
      "Existing appointment, technician ETA, and complaint calls",
    ],
    highValueLabel: "High-value HVAC opportunities",
    primaryWorkflow: workflow("service request", "service requests", "Service requests", "Service requests", "service request", "New service request"),
    secondaryWorkflow: workflow("appointment", "appointments", "Appointments", "Appointment requests", "appointment request", "Appointment request"),
    serviceAreaLabel: "Service area",
    vendorMetricLabel: "Vendor / sales calls",
  },
  plumbing: {
    appointmentNoun: "appointment",
    businessType: "plumbing",
    dashboard: {
      staffFollowUpsLabel: "Needs dispatch",
      topIntentSubtitle: "What customers needed",
    },
    firstCallChecks: [
      "Active leaks, flooding, sewer backups, and no-water calls",
      "Water heater, fixture, drain, and remodel inquiries",
      "Trip-fee, emergency-fee, and warranty questions",
      "Service-area and out-of-area questions",
      "Existing job, invoice, complaint, vendor, and hiring calls",
    ],
    highValueLabel: "High-value plumbing opportunities",
    primaryWorkflow: workflow("service request", "service requests", "Service requests", "Service requests", "service request", "New service request"),
    secondaryWorkflow: workflow("appointment", "appointments", "Appointments", "Appointment requests", "appointment request", "Appointment request"),
    serviceAreaLabel: "Service area",
    vendorMetricLabel: "Vendor / sales calls",
  },
  restaurant: {
    appointmentNoun: "reservation",
    businessType: "restaurant",
    dashboard: {
      staffFollowUpsLabel: "Needs staff",
      topIntentSubtitle: "What callers asked for",
    },
    firstCallChecks: [
      "Hours, parking, directions, and special-day questions",
      "Pickup orders, substitutions, payment, and delivery-driver calls",
      "Reservation, large-party, private-event, and catering requests",
      "Allergy, dietary, complaint, refund, and lost-item calls",
      "Vendor, hiring, donation, and sales calls",
    ],
    highValueLabel: "High-value hospitality opportunities",
    primaryWorkflow: workflow("order", "orders", "Orders", "Orders", "order", "New order"),
    secondaryWorkflow: workflow("reservation", "reservations", "Reservations", "Reservation requests", "reservation request", "Reservation request"),
    serviceAreaLabel: "Location",
    vendorMetricLabel: "Sales / vendor calls",
  },
  roofing: {
    appointmentNoun: "inspection",
    businessType: "roofing",
    dashboard: {
      staffFollowUpsLabel: "Needs office",
      topIntentSubtitle: "What property owners needed",
    },
    firstCallChecks: [
      "Active leak, storm damage, and emergency tarping calls",
      "Roof replacement, repair, gutter, skylight, and inspection requests",
      "Insurance, financing, warranty, and photo-upload questions",
      "Service-area, weather, scheduling, and crew-access questions",
      "Existing job, complaint, vendor, and property-manager calls",
    ],
    highValueLabel: "High-value roofing opportunities",
    primaryWorkflow: workflow("estimate request", "estimate requests", "Estimate requests", "Estimate requests", "estimate request", "New estimate request"),
    secondaryWorkflow: workflow("inspection", "inspections", "Inspections", "Inspection requests", "inspection request", "Inspection request"),
    serviceAreaLabel: "Service area",
    vendorMetricLabel: "Vendor / sales calls",
  },
  salon_barber: {
    appointmentNoun: "appointment",
    businessType: "salon_barber",
    dashboard: {
      staffFollowUpsLabel: "Needs front desk",
      topIntentSubtitle: "What clients asked for",
    },
    firstCallChecks: [
      "Haircut, barber, color, treatment, and bridal booking requests",
      "Provider preference, duration, deposit, and cancellation questions",
      "Product, gift-card, parking, accessibility, and late-arrival questions",
      "Allergy, sensitivity, color-correction, redo, and complaint calls",
      "Vendor, hiring, booth-rental, and partnership calls",
    ],
    highValueLabel: "High-value client opportunities",
    primaryWorkflow: workflow("client request", "client requests", "Client requests", "Client requests", "client request", "New client request"),
    secondaryWorkflow: workflow("booking", "bookings", "Bookings", "Booking requests", "booking request", "Booking request"),
    serviceAreaLabel: "Studio location",
    vendorMetricLabel: "Vendor / product calls",
  },
};

export function getVerticalInsightProfile(value: unknown): VerticalInsightProfile {
  return verticalInsightProfiles[normalizeBusinessType(value)];
}

export function getVerticalOwnerSuggestions(value: unknown) {
  const profile = getVerticalInsightProfile(value);

  return [
    "What happened today?",
    "Any urgent calls?",
    "What needs follow-up?",
    `Any ${profile.highValueLabel.toLowerCase()}?`,
    "What questions did you not know?",
    "Any complaints?",
    `How many ${profile.primaryWorkflow.plural}?`,
    `How many ${profile.secondaryWorkflow.plural}?`,
  ];
}

export function formatVerticalIntent(intent: string, value: unknown) {
  const profile = getVerticalInsightProfile(value);
  const template = getBusinessTemplate(profile.businessType);
  const normalized = intent.toLowerCase().replace(/_/g, " ");

  switch (normalized) {
    case "order":
      return titleCase(profile.primaryWorkflow.singular);
    case "reservation":
      return titleCase(profile.secondaryWorkflow.singular);
    case "hours":
      return profile.businessType === "restaurant" ? "Hours" : "Hours and availability";
    case "faq":
      return profile.businessType === "restaurant" ? "FAQ" : `${titleCase(template.offeringNoun)} FAQ`;
    case "sales":
      return profile.vendorMetricLabel;
    default:
      return titleCase(normalized);
  }
}

function workflow(
  singular: string,
  plural: string,
  metricLabel: string,
  copyLabel: string,
  ownerPhrase: string,
  activityTitle: string,
): VerticalWorkflowLabel {
  return {
    activityTitle,
    copyLabel,
    metricLabel,
    ownerPhrase,
    plural,
    singular,
  };
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
