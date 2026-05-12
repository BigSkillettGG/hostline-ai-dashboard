import { describe, expect, it, vi } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import { createReservationPlatformService } from "./reservation-platform-service";

describe("reservation platform service", () => {
  it("falls back to staff-confirmed manual reservations without OpenTable credentials", async () => {
    const service = createReservationPlatformService({});

    expect(service.configured).toBe(false);
    expect(service.provider).toBe("manual_request");
    await expect(
      service.createReservation({
        context: demoRestaurantContext,
        date: "2026-05-12",
        guestName: "Tim Schneider",
        partySize: 4,
        time: "18:00",
      }),
    ).resolves.toMatchObject({
      ok: true,
      provider: "manual_request",
      status: "pending_staff_confirmation",
    });
  });

  it("posts a reservation request to the configured OpenTable endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ confirmation_code: "OT-123", reservation_id: "res_123" }), {
        status: 201,
      }),
    );
    const service = createReservationPlatformService(
      {
        OPENTABLE_CLIENT_ID: "client",
        OPENTABLE_CLIENT_SECRET: "secret",
        OPENTABLE_RESERVATIONS_URL: "https://sandbox-api.opentable.example/reservations",
        OPENTABLE_RESTAURANT_ID: "restaurant_123",
      },
      fetchMock,
    );

    const result = await service.createReservation({
      callId: "call_123",
      callerPhone: "+17813072672",
      context: demoRestaurantContext,
      date: "2026-05-12",
      guestName: "Tim Schneider",
      locationId: "location_123",
      notes: "Birthday",
      partySize: 4,
      time: "18:00",
    });

    expect(result).toMatchObject({
      confirmationCode: "OT-123",
      ok: true,
      provider: "opentable",
      providerReservationId: "res_123",
      status: "confirmed",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox-api.opentable.example/reservations",
      expect.objectContaining({
        body: expect.stringContaining('"restaurant_id":"restaurant_123"'),
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"source":"hostline_ai"');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-OpenTable-Restaurant-Id": "restaurant_123",
    });
  });

  it("uses OpenTable OAuth when an auth URL is configured", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token_123", expires_in: 3600 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "res_123" }), { status: 201 }));
    const service = createReservationPlatformService(
      {
        OPENTABLE_AUTH_URL: "https://auth.opentable.example/oauth/token",
        OPENTABLE_CLIENT_ID: "client",
        OPENTABLE_CLIENT_SECRET: "secret",
        OPENTABLE_RESERVATIONS_URL: "https://sandbox-api.opentable.example/reservations",
        OPENTABLE_RESTAURANT_ID: "restaurant_123",
      },
      fetchMock,
    );

    await service.createReservation({
      context: demoRestaurantContext,
      date: "2026-05-12",
      guestName: "Tim Schneider",
      partySize: 4,
      time: "18:00",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://auth.opentable.example/oauth/token");
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer token_123",
    });
  });
});
