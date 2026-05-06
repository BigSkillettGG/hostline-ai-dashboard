import { describe, expect, it } from "vitest";
import {
  channelsForRecipients,
  normalizeStaffAlertEventStatus,
  summarizeAlertRecipients,
} from "./alert-events";

describe("alert events", () => {
  it("summarizes named recipients for compact tables", () => {
    expect(
      summarizeAlertRecipients([
        { channel: "sms", email: "", id: "one", name: "Maria", phone: "+15550100" },
        { channel: "email", email: "gm@example.com", id: "two", name: "GM", phone: "" },
        { channel: "sms", email: "", id: "three", name: "Counter", phone: "+15550200" },
      ]),
    ).toBe("Maria, GM +1");
  });

  it("normalizes event status values", () => {
    expect(normalizeStaffAlertEventStatus("sent")).toBe("sent");
    expect(normalizeStaffAlertEventStatus("weird")).toBe("skipped");
  });

  it("derives channel labels from recipient counts", () => {
    expect(channelsForRecipients({ emailRecipientCount: 1, smsRecipientCount: 2 })).toEqual(["sms", "email/webhook"]);
    expect(channelsForRecipients({ emailRecipientCount: 0, smsRecipientCount: 0 })).toEqual([]);
  });
});
