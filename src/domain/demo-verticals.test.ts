import { describe, expect, it } from "vitest";
import { buildDemoAgentEmail, verticalDemoProfiles } from "./demo-verticals";

describe("vertical demo profiles", () => {
  it("defines one routable demo business for each launch vertical", () => {
    expect(verticalDemoProfiles.map((profile) => profile.businessType).sort()).toEqual([
      "electrical",
      "hvac",
      "plumbing",
      "restaurant",
      "roofing",
      "salon_barber",
    ]);

    expect(new Set(verticalDemoProfiles.map((profile) => profile.locationId)).size).toBe(verticalDemoProfiles.length);
    expect(new Set(verticalDemoProfiles.map((profile) => profile.accountEmail)).size).toBe(verticalDemoProfiles.length);
    expect(verticalDemoProfiles.every((profile) => buildDemoAgentEmail(profile).routable)).toBe(true);
  });
});
