import { describe, expect, it } from "vitest";
import { buildScenarioReport, summarizeScenarioRuns, voiceScenarios } from "./scenario-lab";

describe("scenario lab", () => {
  it("summarizes scenario run status and critical gaps", () => {
    const scenarios = voiceScenarios.slice(0, 3);

    expect(
      summarizeScenarioRuns(scenarios, {
        [scenarios[0].id]: { status: "passed" },
        [scenarios[1].id]: { status: "needs_work" },
      }),
    ).toEqual({
      needs_work: 1,
      openCritical: 2,
      passed: 1,
      total: 3,
      untested: 1,
    });
  });

  it("builds a copyable report with notes", () => {
    const scenario = voiceScenarios[0];
    const report = buildScenarioReport([scenario], {
      [scenario.id]: {
        notes: "Restarted after the second question.",
        status: "needs_work",
      },
    });

    expect(report).toContain(scenario.title);
    expect(report).toContain("Status: needs_work");
    expect(report).toContain("Restarted after the second question.");
  });
});
