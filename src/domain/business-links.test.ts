import { describe, expect, it } from "vitest";
import { findBusinessLink, normalizeBusinessLinkKind, normalizeCustomerRequestKind } from "./business-links";

describe("business links", () => {
  it("normalizes common link names into reusable link kinds", () => {
    expect(normalizeBusinessLinkKind("online ordering URL")).toBe("ordering");
    expect(normalizeBusinessLinkKind("appointment booking link")).toBe("booking");
    expect(normalizeBusinessLinkKind("estimate form")).toBe("quote");
    expect(normalizeBusinessLinkKind("dinner menu")).toBe("menu");
  });

  it("normalizes cross-industry customer request kinds", () => {
    expect(normalizeCustomerRequestKind("reservation request")).toBe("reservation");
    expect(normalizeCustomerRequestKind("service appointment")).toBe("service_appointment");
    expect(normalizeCustomerRequestKind("free estimate")).toBe("quote");
    expect(normalizeCustomerRequestKind("something else")).toBe("general");
  });

  it("finds a configured link by loose caller intent", () => {
    expect(
      findBusinessLink(
        [
          { kind: "ordering", label: "Online ordering", url: "https://example.com/order" },
          { kind: "reservation", label: "Reservations", url: "https://example.com/reserve" },
        ],
        "reservation link",
      )?.url,
    ).toBe("https://example.com/reserve");
  });
});
