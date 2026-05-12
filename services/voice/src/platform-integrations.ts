import type { VoiceServiceEnv } from "./env";

export type PlatformIntegrationCategory = "ordering" | "reservations";
export type PlatformIntegrationProviderId =
  | "toast"
  | "square"
  | "clover"
  | "opentable"
  | "resy"
  | "sevenrooms"
  | "tock"
  | "yelp_guest_manager"
  | "manual";
export type PlatformIntegrationStatus = "configured" | "manual_fallback" | "needs_credentials";

export interface PlatformIntegrationProvider {
  accessPath: string;
  capabilities: string[];
  category: PlatformIntegrationCategory;
  detail: string;
  documentationUrl?: string;
  id: PlatformIntegrationProviderId;
  missingEnv: string[];
  name: string;
  nextStep: string;
  requiredEnv: string[];
  status: PlatformIntegrationStatus;
}

export interface PlatformIntegrationRegistry {
  orderProviders: PlatformIntegrationProvider[];
  reservationProviders: PlatformIntegrationProvider[];
  summary: {
    configuredOrderProviders: number;
    configuredReservationProviders: number;
    manualFallbackReady: boolean;
    preferredOrderProvider: PlatformIntegrationProviderId;
    preferredReservationProvider: PlatformIntegrationProviderId;
  };
}

type PlatformIntegrationEnv = Pick<
  VoiceServiceEnv,
  | "CLOVER_ACCESS_TOKEN"
  | "CLOVER_MERCHANT_ID"
  | "OPENTABLE_CLIENT_ID"
  | "OPENTABLE_CLIENT_SECRET"
  | "OPENTABLE_RESTAURANT_ID"
  | "RESY_API_KEY"
  | "RESY_VENUE_ID"
  | "SEVENROOMS_CLIENT_ID"
  | "SEVENROOMS_CLIENT_SECRET"
  | "SEVENROOMS_VENUE_ID"
  | "SQUARE_ACCESS_TOKEN"
  | "SQUARE_LOCATION_ID"
  | "TOAST_CLIENT_ID"
  | "TOAST_CLIENT_SECRET"
  | "TOAST_RESTAURANT_GUID"
  | "TOCK_API_KEY"
  | "TOCK_BUSINESS_ID"
  | "YELP_BUSINESS_ID"
  | "YELP_GUEST_MANAGER_API_KEY"
>;

export function createPlatformIntegrationRegistry(env: PlatformIntegrationEnv): PlatformIntegrationRegistry {
  const orderProviders: PlatformIntegrationProvider[] = [
    buildProvider({
      accessPath: "Toast partner API credentials",
      capabilities: ["menu sync", "pickup order injection", "order status"],
      category: "ordering",
      detail: "Primary target for pickup order injection when the restaurant uses Toast.",
      documentationUrl: "https://doc.toasttab.com/",
      env,
      id: "toast",
      name: "Toast",
      nextStep: "Apply for Toast partner/API access, then add the client ID, secret, and restaurant GUID.",
      requiredEnv: ["TOAST_CLIENT_ID", "TOAST_CLIENT_SECRET", "TOAST_RESTAURANT_GUID"],
    }),
    buildProvider({
      accessPath: "Square access token",
      capabilities: ["catalog sync", "order creation", "payment-status lookup"],
      category: "ordering",
      detail: "Useful for restaurants already running Square for Restaurants.",
      documentationUrl: "https://developer.squareup.com/docs",
      env,
      id: "square",
      name: "Square",
      nextStep: "Create a Square app and add the access token and Square location ID.",
      requiredEnv: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"],
    }),
    buildProvider({
      accessPath: "Clover merchant OAuth token",
      capabilities: ["merchant lookup", "order creation"],
      category: "ordering",
      detail: "Order handoff target for Clover merchants.",
      documentationUrl: "https://docs.clover.com/dev/docs",
      env,
      id: "clover",
      name: "Clover",
      nextStep: "Create a Clover app, authorize the merchant, and add the merchant ID and access token.",
      requiredEnv: ["CLOVER_ACCESS_TOKEN", "CLOVER_MERCHANT_ID"],
    }),
    manualProvider("ordering"),
  ];

  const reservationProviders: PlatformIntegrationProvider[] = [
    buildProvider({
      accessPath: "OpenTable API partner sandbox or restaurant-authorized API access",
      capabilities: ["availability lookup", "booking creation", "reservation sync", "reservation links"],
      category: "reservations",
      detail: "Preferred first reservation integration because OpenTable publishes an API partner path, sandbox, Booking API, Sync API, and Directory API reservation links.",
      documentationUrl: "https://www.opentable.com/restaurant-solutions/api-partners/",
      env,
      id: "opentable",
      name: "OpenTable",
      nextStep: "Request OpenTable API sandbox/partner access, then add the client ID, secret, and restaurant ID.",
      requiredEnv: ["OPENTABLE_CLIENT_ID", "OPENTABLE_CLIENT_SECRET", "OPENTABLE_RESTAURANT_ID"],
    }),
    buildProvider({
      accessPath: "Resy partner access",
      capabilities: ["reservation sync after partner access"],
      category: "reservations",
      detail: "Reservation target for Resy venues. Keep after OpenTable because public partner/API onboarding is less explicit.",
      env,
      id: "resy",
      name: "Resy",
      nextStep: "Contact Resy/Amex partnership support for API access before building direct booking calls.",
      requiredEnv: ["RESY_API_KEY", "RESY_VENUE_ID"],
    }),
    buildProvider({
      accessPath: "SevenRooms API credentials",
      capabilities: ["availability lookup", "reservation creation", "guest profiles"],
      category: "reservations",
      detail: "Reservation, guest profile, and high-touch hospitality target for SevenRooms venues.",
      env,
      id: "sevenrooms",
      name: "SevenRooms",
      nextStep: "Add SevenRooms API credentials and venue ID for the pilot venue.",
      requiredEnv: ["SEVENROOMS_CLIENT_ID", "SEVENROOMS_CLIENT_SECRET", "SEVENROOMS_VENUE_ID"],
    }),
    buildProvider({
      accessPath: "Tock API key",
      capabilities: ["event booking", "reservation request sync"],
      category: "reservations",
      detail: "Reservation and event booking target for Tock restaurants.",
      env,
      id: "tock",
      name: "Tock",
      nextStep: "Request Tock API access and add the API key and business ID.",
      requiredEnv: ["TOCK_API_KEY", "TOCK_BUSINESS_ID"],
    }),
    buildProvider({
      accessPath: "Yelp Guest Manager API key",
      capabilities: ["reservation sync", "guest manager handoff"],
      category: "reservations",
      detail: "Reservation target for restaurants using Yelp Guest Manager.",
      env,
      id: "yelp_guest_manager",
      name: "Yelp Guest Manager",
      nextStep: "Add Yelp Guest Manager API credentials for restaurants already using Yelp reservations.",
      requiredEnv: ["YELP_GUEST_MANAGER_API_KEY", "YELP_BUSINESS_ID"],
    }),
    manualProvider("reservations"),
  ];

  return {
    orderProviders,
    reservationProviders,
    summary: {
      configuredOrderProviders: countConfigured(orderProviders),
      configuredReservationProviders: countConfigured(reservationProviders),
      manualFallbackReady: true,
      preferredOrderProvider: firstConfiguredProviderId(orderProviders) ?? "manual",
      preferredReservationProvider: firstConfiguredProviderId(reservationProviders) ?? "manual",
    },
  };
}

function buildProvider({
  category,
  accessPath,
  capabilities,
  documentationUrl,
  detail,
  env,
  id,
  name,
  nextStep,
  requiredEnv,
}: {
  accessPath: string;
  capabilities: string[];
  category: PlatformIntegrationCategory;
  documentationUrl?: string;
  detail: string;
  env: PlatformIntegrationEnv;
  id: PlatformIntegrationProviderId;
  name: string;
  nextStep: string;
  requiredEnv: string[];
}) {
  const missingEnv = requiredEnv.filter((key) => !hasEnvValue(env, key));

  return {
    accessPath,
    capabilities,
    category,
    detail,
    documentationUrl,
    id,
    missingEnv,
    name,
    nextStep,
    requiredEnv,
    status: missingEnv.length ? "needs_credentials" : "configured",
  } satisfies PlatformIntegrationProvider;
}

function manualProvider(category: PlatformIntegrationCategory): PlatformIntegrationProvider {
  return {
    accessPath: "No external provider",
    capabilities: category === "ordering" ? ["staff review queue"] : ["staff-confirmed reservation requests"],
    category,
    detail:
      category === "ordering"
        ? "Fallback path that creates a staff review order when there is no POS integration yet."
        : "Fallback path that creates a staff review reservation request when there is no reservation platform yet.",
    id: "manual",
    missingEnv: [],
    name: "Manual review queue",
    nextStep:
      category === "ordering"
        ? "Keep using staff review until the restaurant's POS credentials are available."
        : "Use the reservation request queue until OpenTable or another booking provider is connected.",
    requiredEnv: [],
    status: "manual_fallback",
  };
}

function countConfigured(providers: PlatformIntegrationProvider[]) {
  return providers.filter((provider) => provider.status === "configured").length;
}

function firstConfiguredProviderId(providers: PlatformIntegrationProvider[]) {
  return providers.find((provider) => provider.status === "configured")?.id;
}

function hasEnvValue(env: PlatformIntegrationEnv, key: string) {
  const value = env[key as keyof PlatformIntegrationEnv];
  return typeof value === "string" && value.trim().length > 0;
}
