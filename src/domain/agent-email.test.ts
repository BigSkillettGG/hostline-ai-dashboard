import { describe, expect, it } from "vitest";
import { buildAgentEmailIdentity, extractLocationIdFromAgentEmail } from "./agent-email";

describe("agent email identity", () => {
  it("builds a human-readable routable alias when a location id is available", () => {
    const identity = buildAgentEmailIdentity({
      businessName: "Olive & Ember",
      hostName: "Ava",
      locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    });

    expect(identity).toMatchObject({
      address: "ava-olive-and-ember+78d8053b-631d-4811-939f-61f0efe1d82a@agents.signalhost.ai",
      displayName: "Ava at Olive & Ember",
      routable: true,
    });
  });

  it("keeps aliases under the email local-part limit", () => {
    const identity = buildAgentEmailIdentity({
      businessName: "A Very Long Restaurant Name With Several Neighborhood Words",
      hostName: "Aiden",
      locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    });

    expect(identity.localPart.length).toBeLessThanOrEqual(64);
    expect(identity.address).toContain("+78d8053b-631d-4811-939f-61f0efe1d82a@");
  });

  it("extracts the location id from a routed alias", () => {
    expect(extractLocationIdFromAgentEmail("Ava <ava-olive+78d8053b-631d-4811-939f-61f0efe1d82a@agents.signalhost.ai>"))
      .toBe("78d8053b-631d-4811-939f-61f0efe1d82a");
  });
});
