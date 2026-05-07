import { describe, expect, it } from "vitest";
import {
  callHandlingLabels,
  defaultRestaurantAgentConfig,
  orderDestinationLabels,
  reservationModeLabels,
} from "./restaurant-config";

describe("restaurant agent configuration", () => {
  it("defaults to the MVP-safe order and payment workflow", () => {
    expect(defaultRestaurantAgentConfig.orders.enabled).toBe(true);
    expect(defaultRestaurantAgentConfig.orders.paymentMode).toBe("pay_at_pickup");
    expect(defaultRestaurantAgentConfig.orders.destinations).toContain("staff_review");
  });

  it("keeps setup labels available for each core configuration group", () => {
    expect(callHandlingLabels.answer_after_rings).toBe("Answer after X rings");
    expect(orderDestinationLabels.kitchen_tablet).toBe("Kitchen tablet");
    expect(reservationModeLabels.manual_request).toBe("Create manual requests");
  });

  it("uses staff confirmation for manual reservation fallback", () => {
    expect(defaultRestaurantAgentConfig.reservations.requireStaffConfirmationWithoutIntegration).toBe(true);
  });

  it("defaults the V1 host voice to Eve", () => {
    expect(defaultRestaurantAgentConfig.voiceGender).toBe("female");
  });
});
