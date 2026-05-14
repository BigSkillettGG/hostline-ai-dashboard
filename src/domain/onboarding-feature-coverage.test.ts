import { describe, expect, it } from "vitest";
import { businessTypeOptions } from "./business-templates";
import { getBusinessOnboardingSections } from "./onboarding";
import { onboardingFeatureCoverage } from "./onboarding-feature-coverage";

describe("onboarding feature coverage", () => {
  it("keeps every covered feature tied to real interview fields", () => {
    const allFieldIds = new Set(
      businessTypeOptions.flatMap((option) =>
        getBusinessOnboardingSections(option.value).flatMap((section) => section.fields.map((field) => field.id)),
      ),
    );

    for (const coverage of onboardingFeatureCoverage) {
      expect(coverage.fieldIds.length, coverage.feature).toBeGreaterThan(0);
      expect(coverage.runtimeTieBack, coverage.feature).toBeTruthy();
      expect(coverage.launchTieBack, coverage.feature).toBeTruthy();

      for (const fieldId of coverage.fieldIds) {
        expect(allFieldIds.has(fieldId), `${coverage.feature} references missing field ${fieldId}`).toBe(true);
      }
    }
  });

  it("keeps all-vertical capabilities present in every vertical interview", () => {
    for (const option of businessTypeOptions) {
      const fieldIds = new Set(
        getBusinessOnboardingSections(option.value).flatMap((section) => section.fields.map((field) => field.id)),
      );

      for (const coverage of onboardingFeatureCoverage.filter((item) => item.allVerticals)) {
        for (const fieldId of coverage.fieldIds) {
          expect(fieldIds.has(fieldId), `${coverage.feature} missing ${fieldId} for ${option.value}`).toBe(true);
        }
      }
    }
  });
});
