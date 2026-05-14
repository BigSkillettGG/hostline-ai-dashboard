import type { ScenarioRunState } from "@/domain/scenario-lab";

export type ScenarioRunAudience = "app" | "super";

export const scenarioRunStorageKeyByAudience: Record<ScenarioRunAudience, string> = {
  app: "signalhost.appScenarioLab.v1",
  super: "signalhost.scenarioLab.v1",
};

export function loadScenarioRuns(audience: ScenarioRunAudience) {
  const storage = getLocalStorage();
  if (!storage) return {};

  try {
    const parsed = JSON.parse(storage.getItem(scenarioRunStorageKeyByAudience[audience]) ?? "{}") as Record<string, ScenarioRunState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveScenarioRuns(audience: ScenarioRunAudience, runs: Record<string, ScenarioRunState>) {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(scenarioRunStorageKeyByAudience[audience], JSON.stringify(runs));
}

function getLocalStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
