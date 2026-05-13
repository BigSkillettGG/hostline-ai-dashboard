import { describe, expect, it } from "vitest";
import {
  buildCustomerMessage,
  buildCustomerRequestResolutionDraft,
  normalizeCustomerRequestResponseStatus,
} from "./customer-requests";

describe("customer request resolution", () => {
  it("builds a reusable knowledge draft and customer response", () => {
    expect(
      buildCustomerRequestResolutionDraft({
        answer: "The bathroom is white",
        businessName: "Olive & Ember",
        callId: "call_1",
        customerContext: "Caller asked what color the bathroom is.",
        sourceQuestion: "What color is the bathroom?",
      }),
    ).toEqual({
      answer: "The bathroom is white",
      customerMessage: "Thanks for your patience. Olive & Ember confirmed: The bathroom is white.",
      knowledgeBody:
        "Customer question: What color is the bathroom?\n\nOriginal context: Caller asked what color the bathroom is.\n\nApproved answer: The bathroom is white\n\nSource call: call_1",
      knowledgeTitle: "Customer answer - What color is the bathroom?",
      sourceQuestion: "What color is the bathroom?",
    });
  });

  it("normalizes response statuses and punctuation", () => {
    expect(normalizeCustomerRequestResponseStatus("sent")).toBe("sent");
    expect(normalizeCustomerRequestResponseStatus("mystery")).toBe("not_needed");
    expect(buildCustomerMessage("It is blue")).toBe("Thanks for your patience. The team confirmed: It is blue.");
  });
});
