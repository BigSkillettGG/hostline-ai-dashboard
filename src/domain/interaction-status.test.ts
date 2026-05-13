import { describe, expect, it } from "vitest";
import type { Call } from "@/data/mock";
import { buildInteractionInsight } from "./interaction-status";

const baseCall: Call = {
  caller: "Test Caller",
  confidence: 95,
  duration: 60,
  id: "call_1",
  intent: "faq",
  outcome: "resolved",
  phone: "+15555550123",
  status: "resolved",
  summary: "Caller asked about parking and got the answer.",
  time: "2026-05-13T12:00:00.000Z",
  transcript: [],
};

describe("interaction status", () => {
  it("keeps simple resolved FAQ calls quiet", () => {
    const insight = buildInteractionInsight({ call: baseCall });

    expect(insight.workflowStatus).toBe("resolved");
    expect(insight.urgency).toBe("low");
    expect(insight.valueTier).toBe("low");
    expect(insight.followUpNeeded).toBe(false);
    expect(insight.recommendedAction).toBe("No action needed.");
  });

  it("escalates open complaints as urgent risk", () => {
    const insight = buildInteractionInsight({
      call: {
        ...baseCall,
        confidence: 82,
        escalation: {
          alertedAt: "2026-05-13T12:02:00.000Z",
          alertedTo: ["manager@example.com"],
          channels: ["sms"],
          severity: "high",
          status: "pending_callback",
          summary: "Customer upset about wrong order and wants a manager callback.",
          type: "complaint",
        },
        intent: "complaint",
        outcome: "manager_alerted",
        status: "needs_review",
        summary: "Wrong order complaint. Caller upset and wants a manager callback.",
      },
    });

    expect(insight.workflowStatus).toBe("escalated");
    expect(insight.urgency).toBe("urgent");
    expect(insight.valueTier).toBe("risk");
    expect(insight.followUpNeeded).toBe(true);
    expect(insight.ownerReportBucket).toBe("risk_or_complaint");
  });

  it("flags low-confidence unknown answers as knowledge gaps", () => {
    const insight = buildInteractionInsight({
      call: {
        ...baseCall,
        confidence: 58,
        outcome: "unknown",
        status: "needs_review",
        summary: "Vera was not sure and told the caller staff would get back to them.",
      },
    });

    expect(insight.workflowStatus).toBe("needs_review");
    expect(insight.knowledgeGap).toBe(true);
    expect(insight.ownerReportBucket).toBe("knowledge_gap");
    expect(insight.recommendedAction).toBe("Review the answer and add missing knowledge if needed.");
  });

  it("treats large catering and private event calls as high-value follow-up", () => {
    const insight = buildInteractionInsight({
      call: {
        ...baseCall,
        confidence: 91,
        intent: "reservation",
        outcome: "message_taken",
        status: "new",
        summary: "Caller asked about catering for 45 guests and a possible private event buyout.",
      },
    });

    expect(insight.valueTier).toBe("very_high");
    expect(insight.followUpNeeded).toBe(true);
    expect(insight.ownerReportBucket).toBe("open_follow_up");
    expect(insight.recommendedAction).toBe("Follow up on this high-value request.");
  });

  it("routes vendor sales calls to the low-value bucket when no action is needed", () => {
    const insight = buildInteractionInsight({
      call: {
        ...baseCall,
        intent: "sales",
        outcome: "resolved",
        summary: "Vendor sales call asked for the manager about equipment financing. Message was not urgent.",
      },
    });

    expect(insight.workflowStatus).toBe("spam_vendor");
    expect(insight.urgency).toBe("low");
    expect(insight.valueTier).toBe("low");
    expect(insight.ownerReportBucket).toBe("low_value");
  });
});
