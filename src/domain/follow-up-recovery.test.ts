import { describe, expect, it } from "vitest";
import type { StaffTask } from "./staff-tasks";
import {
  buildFollowUpRecoveryInsight,
  formatRecoveryChannel,
  summarizeFollowUpRecovery,
} from "./follow-up-recovery";

const now = new Date("2026-05-14T16:00:00.000Z");

const baseTask: StaffTask = {
  createdAt: "2026-05-14T15:00:00.000Z",
  id: "task_1",
  priority: "normal",
  status: "open",
  title: "Follow up",
  type: "general",
};

describe("follow-up recovery", () => {
  it("treats catering and private event tasks as high-value owner-approved recovery", () => {
    const task: StaffTask = {
      ...baseTask,
      body: "Website visitor asked for a catering quote and private event package options.",
      priority: "high",
      title: "Follow up on catering lead",
      type: "customer_request",
    };

    const insight = buildFollowUpRecoveryInsight(task, now);

    expect(insight.category).toBe("revenue");
    expect(insight.valueTier).toBe("very_high");
    expect(insight.revenueRecovery).toBe(true);
    expect(insight.approvalRequired).toBe(true);
    expect(insight.suggestedChannel).toBe("email");
    expect(insight.draftMessage).toContain("catering lead");
  });

  it("routes complaints and severe allergy issues as immediate risk callbacks", () => {
    const task: StaffTask = {
      ...baseTask,
      body: "Caller said their child has a severe peanut allergy and wants a manager callback.",
      priority: "urgent",
      title: "Call back allergy guest",
      type: "manager_callback",
    };

    const insight = buildFollowUpRecoveryInsight(task, now);

    expect(insight.category).toBe("risk");
    expect(insight.valueTier).toBe("risk");
    expect(insight.suggestedChannel).toBe("call");
    expect(insight.riskLabel).toBe("Do not batch");
  });

  it("recognizes low-confidence customer answers as knowledge recovery", () => {
    const task: StaffTask = {
      ...baseTask,
      body: "Question: What color is the bathroom?",
      title: "Unknown customer question",
      type: "low_confidence_review",
    };

    const insight = buildFollowUpRecoveryInsight(task, now);

    expect(insight.category).toBe("knowledge");
    expect(insight.ownerPrompt).toBe("What is the correct answer SignalHost should remember?");
    expect(insight.suggestedChannel).toBe("staff_note");
  });

  it("summarizes the active recovery queue", () => {
    const tasks: StaffTask[] = [
      {
        ...baseTask,
        body: "Caller wants a roof replacement estimate.",
        id: "task_high",
        priority: "high",
        title: "Roof replacement quote",
        type: "customer_request",
      },
      {
        ...baseTask,
        body: "Vendor asked for the owner.",
        id: "task_vendor",
        priority: "low",
        title: "Vendor callback",
        type: "general",
      },
      {
        ...baseTask,
        body: "Caller complaint about a missing order.",
        id: "task_risk",
        priority: "urgent",
        title: "Complaint callback",
        type: "manager_callback",
      },
      {
        ...baseTask,
        id: "task_done",
        status: "done",
      },
    ];

    const summary = summarizeFollowUpRecovery(tasks, now);

    expect(summary.revenueOpportunities).toBe(1);
    expect(summary.riskItems).toBe(1);
    expect(summary.ownerApproval).toBe(2);
    expect(summary.recoveryTasks.map((task) => task.id)).toContain("task_high");
    expect(summary.topTasks[0].id).toBe("task_risk");
  });

  it("formats staff note channels for display", () => {
    expect(formatRecoveryChannel("staff_note")).toBe("Staff note");
    expect(formatRecoveryChannel("text")).toBe("Text");
  });
});
