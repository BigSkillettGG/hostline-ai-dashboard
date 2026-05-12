import { describe, expect, it } from "vitest";
import { createPlatformIntegrationRegistry } from "./platform-integrations";

describe("platform integration registry", () => {
  it("keeps manual order and reservation fallbacks ready without provider credentials", () => {
    const registry = createPlatformIntegrationRegistry({});

    expect(registry.summary).toMatchObject({
      configuredOrderProviders: 0,
      configuredReservationProviders: 0,
      manualFallbackReady: true,
      preferredOrderProvider: "manual",
      preferredReservationProvider: "manual",
    });
    expect(registry.orderProviders.find((provider) => provider.id === "manual")).toMatchObject({
      status: "manual_fallback",
    });
    expect(registry.reservationProviders.find((provider) => provider.id === "manual")).toMatchObject({
      status: "manual_fallback",
    });
  });

  it("marks Toast and OpenTable configured when their credentials exist", () => {
    const registry = createPlatformIntegrationRegistry({
      OPENTABLE_CLIENT_ID: "ot-client",
      OPENTABLE_CLIENT_SECRET: "ot-secret",
      OPENTABLE_RESERVATIONS_URL: "https://sandbox-api.opentable.example/reservations",
      OPENTABLE_RESTAURANT_ID: "ot-restaurant",
      TOAST_CLIENT_ID: "toast-client",
      TOAST_CLIENT_SECRET: "toast-secret",
      TOAST_RESTAURANT_GUID: "toast-restaurant",
    });

    expect(registry.summary).toMatchObject({
      configuredOrderProviders: 1,
      configuredReservationProviders: 1,
      preferredOrderProvider: "toast",
      preferredReservationProvider: "opentable",
    });
    expect(registry.orderProviders.find((provider) => provider.id === "toast")).toMatchObject({
      missingEnv: [],
      status: "configured",
    });
    expect(registry.reservationProviders.find((provider) => provider.id === "opentable")).toMatchObject({
      missingEnv: [],
      status: "configured",
    });
  });

  it("reports missing credentials for partially configured providers", () => {
    const registry = createPlatformIntegrationRegistry({
      TOAST_CLIENT_ID: "toast-client",
    });

    expect(registry.orderProviders.find((provider) => provider.id === "toast")).toMatchObject({
      missingEnv: ["TOAST_CLIENT_SECRET", "TOAST_RESTAURANT_GUID"],
      status: "needs_credentials",
    });
    expect(registry.reservationProviders.find((provider) => provider.id === "opentable")).toMatchObject({
      missingEnv: [
        "OPENTABLE_CLIENT_ID",
        "OPENTABLE_CLIENT_SECRET",
        "OPENTABLE_RESTAURANT_ID",
        "OPENTABLE_RESERVATIONS_URL",
      ],
      status: "needs_credentials",
    });
  });
});
