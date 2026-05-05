import { describe, expect, it } from "vitest";
import { formatStaffAlertMessage } from "./notification-service";

describe("staff alert formatting", () => {
  it("formats order alerts for SMS or webhook delivery", () => {
    expect(
      formatStaffAlertMessage({
        callerPhone: "+14155550148",
        details: ["Items: 2 Margherita Pizza, 1 Caesar Salad", "ETA: 25 min", "Payment: pay at pickup"],
        kind: "order",
        restaurantName: "Olive & Ember",
        summary: "Staff-review pickup order created for Sarah.",
      }),
    ).toContain("New phone order - Olive & Ember");
  });

  it("keeps long caller text bounded for staff channels", () => {
    const message = formatStaffAlertMessage({
      details: [`Caller said: ${"wrong order ".repeat(200)}`],
      kind: "complaint",
      restaurantName: "Olive & Ember",
      summary: "Complaint or refund risk detected.",
    });

    expect(message.length).toBeLessThanOrEqual(900);
    expect(message).toContain("Complaint alert - Olive & Ember");
  });
});
