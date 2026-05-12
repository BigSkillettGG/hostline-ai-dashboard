import { createOnboardingDraftForBusiness, sampleOnboardingDraft, type OnboardingDraft } from "@/domain/onboarding";

const storageKey = "signalhost:onboarding-draft";

export function loadOnboardingDraft(): OnboardingDraft {
  if (typeof window === "undefined") return sampleOnboardingDraft;

  const rawDraft = window.localStorage.getItem(storageKey);
  if (!rawDraft) return sampleOnboardingDraft;

  try {
    const parsedDraft = JSON.parse(rawDraft) as OnboardingDraft;
    return { ...createOnboardingDraftForBusiness(String(parsedDraft.businessType ?? "restaurant")), ...parsedDraft };
  } catch {
    return sampleOnboardingDraft;
  }
}

export function saveOnboardingDraft(draft: OnboardingDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(draft));
}
