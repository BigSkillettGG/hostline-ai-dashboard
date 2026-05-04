import { sampleOnboardingDraft, type OnboardingDraft } from "@/domain/onboarding";

const storageKey = "hostline:onboarding-draft";

export function loadOnboardingDraft(): OnboardingDraft {
  if (typeof window === "undefined") return sampleOnboardingDraft;

  const rawDraft = window.localStorage.getItem(storageKey);
  if (!rawDraft) return sampleOnboardingDraft;

  try {
    return { ...sampleOnboardingDraft, ...(JSON.parse(rawDraft) as OnboardingDraft) };
  } catch {
    return sampleOnboardingDraft;
  }
}

export function saveOnboardingDraft(draft: OnboardingDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(draft));
}
