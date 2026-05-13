import { describe, expect, it } from "vitest";
import {
  buildScenarioReport,
  defaultScenarioTestMessage,
  extractScenarioTestMessages,
  getScenarioNextTestMessage,
  getScenarioTestChannel,
  reviewScenarioReplies,
  summarizeScenarioRuns,
  voiceScenarios,
} from "./scenario-lab";

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

  it("extracts runnable caller messages from scenario scripts", () => {
    const scenario = voiceScenarios.find((item) => item.id === "restaurant-specials-parking-close");

    expect(scenario).toBeDefined();
    expect(extractScenarioTestMessages(scenario!)).toEqual([
      "Hi, do you have any specials tonight?",
      "Great, do you have parking nearby?",
      "No, that's all.",
    ]);
    expect(defaultScenarioTestMessage(scenario!)).toBe("Hi, do you have any specials tonight?");
    expect(getScenarioNextTestMessage(scenario!, 1)).toBe("Great, do you have parking nearby?");
    expect(getScenarioTestChannel(scenario!)).toBe("phone");
  });

  it("detects likely reply regressions in scenario output", () => {
    const scenario = voiceScenarios.find((item) => item.id === "restaurant-specials-parking-close")!;

    expect(
      reviewScenarioReplies(scenario, [
        {
          callerMessage: "Hi, do you have specials tonight?",
          reply: "Tonight's specials are branzino and risotto. Anything else I can help with?",
        },
        {
          callerMessage: "Do you have parking nearby?",
          reply: "Thank you for calling Olive and Ember. How can I help you?",
        },
        {
          callerMessage: "No, that's all.",
          reply: "Okay.",
        },
      ]),
    ).toEqual([
      "Possible mid-call greeting restart after the first answer.",
      "Final no/that's-all turn did not clearly close the call.",
    ]);
  });
});
