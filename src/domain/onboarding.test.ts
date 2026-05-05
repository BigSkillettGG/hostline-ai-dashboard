import { describe, expect, it } from "vitest";
import {
  calculateOnboardingProgress,
  onboardingSections,
  productionWorkstreams,
  sampleOnboardingDraft,
} from "./onboarding";

describe("restaurant onboarding scope", () => {
  it("covers the production onboarding interview areas", () => {
    expect(onboardingSections.map((section) => section.id)).toEqual([
      "basics",
      "menus",
      "hours",
      "orders",
      "reservations",
      "policies",
      "escalations",
      "voice",
      "launch",
    ]);
  });

  it("keeps the remaining production build visible", () => {
    expect(productionWorkstreams).toHaveLength(12);
  });

  it("calculates launch-readiness progress from required fields", () => {
    const progress = calculateOnboardingProgress(sampleOnboardingDraft);

    expect(progress.percent).toBeGreaterThan(70);
    expect(progress.completedRequired).toBeLessThanOrEqual(progress.totalRequired);
    expect(progress.missingBySection).toHaveLength(onboardingSections.length);
  });
});
