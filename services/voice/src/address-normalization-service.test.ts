import { describe, expect, it, vi } from "vitest";
import { normalizeCustomerAddress } from "./address-normalization-service";
import { demoRestaurantContext } from "./restaurant-context";

const baseContext = {
  ...demoRestaurantContext,
  policies: {
    ...demoRestaurantContext.policies,
    location: "10 Main Street, Duxbury, MA 02332",
  },
};

describe("address normalization service", () => {
  it("asks only for missing city or state when Google is not configured", async () => {
    const result = await normalizeCustomerAddress({
      context: baseContext,
      env: {},
      rawAddress: "5 Old Barn Road",
    });

    expect(result).toMatchObject({
      ok: true,
      status: "needs_more_detail",
    });
    expect(result.missing).toContain("city_or_state");
    expect(result.callerGuidance).toContain("Ask only for the missing");
  });

  it("reads back a complete unverified address with the unit included", async () => {
    const result = await normalizeCustomerAddress({
      context: baseContext,
      env: {},
      rawAddress: "5 Old Barn Road, Duxbury, Massachusetts",
      unitOrAccess: "Apt 2B",
    });

    expect(result).toMatchObject({
      formattedAddress: "5 Old Barn Road Apt 2B, Duxbury, Massachusetts",
      serviceAddress: "5 Old Barn Road Apt 2B, Duxbury, Massachusetts",
      status: "likely_complete_unverified",
      unitOrAccess: "Apt 2B",
    });
    expect(result.readBack).toContain("I've got 5 Old Barn Road Apt 2B, Duxbury, Massachusetts");
  });

  it("validates and geolocates an address through Google Places", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              addressComponents: [
                { longText: "5", types: ["street_number"] },
                { longText: "Old Barn Road", types: ["route"] },
                { longText: "Duxbury", types: ["locality"] },
                { longText: "Massachusetts", shortText: "MA", types: ["administrative_area_level_1"] },
                { longText: "02332", types: ["postal_code"] },
                { longText: "United States", shortText: "US", types: ["country"] },
              ],
              formattedAddress: "5 Old Barn Rd, Duxbury, MA 02332, USA",
              googleMapsUri: "https://maps.google.com/?cid=123",
              id: "place_123",
              location: {
                latitude: 42.031,
                longitude: -70.68,
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await normalizeCustomerAddress({
      context: baseContext,
      env: { GOOGLE_MAPS_API_KEY: "maps-key" },
      fetchImpl: fetchMock,
      rawAddress: "5 Old Barn Road in Duxbury",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:searchText",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "maps-key",
          "X-Goog-FieldMask": expect.stringContaining("places.formattedAddress"),
        }),
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      regionCode: "US",
      textQuery: "5 Old Barn Road in Duxbury Duxbury, MA 02332",
    });
    expect(result).toMatchObject({
      formattedAddress: "5 Old Barn Rd, Duxbury, MA 02332, USA",
      googleMapsUri: "https://maps.google.com/?cid=123",
      latitude: 42.031,
      longitude: -70.68,
      placeId: "place_123",
      serviceAddress: "5 Old Barn Rd, Duxbury, MA 02332, USA",
      status: "validated",
    });
    expect(result.readBack).toContain("I've got 5 Old Barn Road in Duxbury, Massachusetts");
  });
});
