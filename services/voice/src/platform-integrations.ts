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
  category: PlatformIntegrationCategory;
  detail: string;
  id: PlatformIntegrationProviderId;
  missingEnv: string[];
  name: string;
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
      category: "ordering",
      detail: "Primary target for pickup order injection when the restaurant uses Toast.",
      env,
      id: "toast",
      name: "Toast",
      requiredEnv: ["TOAST_CLIENT_ID", "TOAST_CLIENT_SECRET", "TOAST_RESTAURANT_GUID"],
    }),
    buildProvider({
      category: "ordering",
      detail: "Useful for restaurants already running Square for Restaurants.",
      env,
      id: "square",
      name: "Square",
      requiredEnv: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"],
    }),
    buildProvider({
      category: "ordering",
      detail: "Order handoff target for Clover merchants.",
      env,
      id: "clover",
      name: "Clover",
      requiredEnv: ["CLOVER_ACCESS_TOKEN", "CLOVER_MERCHANT_ID"],
    }),
    manualProvider("ordering"),
  ];

  const reservationProviders: PlatformIntegrationProvider[] = [
    buildProvider({
      category: "reservations",
      detail: "Primary reservation target for restaurants that use OpenTable.",
      env,
      id: "opentable",
      name: "OpenTable",
      requiredEnv: ["OPENTABLE_CLIENT_ID", "OPENTABLE_CLIENT_SECRET", "OPENTABLE_RESTAURANT_ID"],
    }),
    buildProvider({
      category: "reservations",
      detail: "Reservation target for Resy venues.",
      env,
      id: "resy",
      name: "Resy",
      requiredEnv: ["RESY_API_KEY", "RESY_VENUE_ID"],
    }),
    buildProvider({
      category: "reservations",
      detail: "Reservation, guest profile, and high-touch hospitality target for SevenRooms venues.",
      env,
      id: "sevenrooms",
      name: "SevenRooms",
      requiredEnv: ["SEVENROOMS_CLIENT_ID", "SEVENROOMS_CLIENT_SECRET", "SEVENROOMS_VENUE_ID"],
    }),
    buildProvider({
      category: "reservations",
      detail: "Reservation and event booking target for Tock restaurants.",
      env,
      id: "tock",
      name: "Tock",
      requiredEnv: ["TOCK_API_KEY", "TOCK_BUSINESS_ID"],
    }),
    buildProvider({
      category: "reservations",
      detail: "Reservation target for restaurants using Yelp Guest Manager.",
      env,
      id: "yelp_guest_manager",
      name: "Yelp Guest Manager",
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
  detail,
  env,
  id,
  name,
  requiredEnv,
}: {
  category: PlatformIntegrationCategory;
  detail: string;
  env: PlatformIntegrationEnv;
  id: PlatformIntegrationProviderId;
  name: string;
  requiredEnv: string[];
}) {
  const missingEnv = requiredEnv.filter((key) => !hasEnvValue(env, key));

  return {
    category,
    detail,
    id,
    missingEnv,
    name,
    requiredEnv,
    status: missingEnv.length ? "needs_credentials" : "configured",
  } satisfies PlatformIntegrationProvider;
}

function manualProvider(category: PlatformIntegrationCategory): PlatformIntegrationProvider {
  return {
    category,
    detail:
      category === "ordering"
        ? "Fallback path that creates a staff review order when there is no POS integration yet."
        : "Fallback path that creates a staff review reservation request when there is no reservation platform yet.",
    id: "manual",
    missingEnv: [],
    name: "Manual review queue",
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
