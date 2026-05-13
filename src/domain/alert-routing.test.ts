import { describe, expect, it } from "vitest";
import {
  defaultAlertRoutingConfig,
  normalizeAlertRoutingConfig,
  resolveAlertRoute,
  resolveTrustedContactAlertRoute,
} from "./alert-routing";
import type { TrustedContact } from "./trusted-contacts";

describe("alert routing", () => {
  it("normalizes partial configs against defaults", () => {
    const config = normalizeAlertRoutingConfig({
      routes: {
        complaint: {
          enabled: false,
          recipients: [{ channel: "both", email: "ops@example.com", id: "ops", name: "Ops", phone: "+15550100" }],
          severityThreshold: "high",
        },
      },
      updatedAt: "2026-05-06T12:00:00.000Z",
    });

    expect(config.routes.complaint).toMatchObject({
      enabled: false,
      severityThreshold: "high",
    });
    expect(config.routes.complaint.recipients[0]).toMatchObject({
      channel: "both",
      email: "ops@example.com",
      phone: "+15550100",
    });
    expect(config.routes.order).toEqual(defaultAlertRoutingConfig.routes.order);
    expect(config.updatedAt).toBe("2026-05-06T12:00:00.000Z");
  });

  it("resolves recipients by route, channel, and severity threshold", () => {
    const config = normalizeAlertRoutingConfig({
      routes: {
        complaint: {
          enabled: true,
          quietHoursEnabled: false,
          recipients: [
            { channel: "sms", email: "", id: "sms", name: "SMS", phone: "+15550100" },
            { channel: "email", email: "owner@example.com", id: "email", name: "Email", phone: "" },
            { channel: "both", email: "gm@example.com", id: "both", name: "GM", phone: "+15550200" },
          ],
          severityThreshold: "medium",
        },
      },
    });

    expect(resolveAlertRoute(config, "complaint", "low").enabled).toBe(false);

    const resolved = resolveAlertRoute(config, "complaint", "high");
    expect(resolved.enabled).toBe(true);
    expect(resolved.smsRecipients.map((recipient) => recipient.id)).toEqual(["sms", "both"]);
    expect(resolved.emailRecipients.map((recipient) => recipient.id)).toEqual(["email", "both"]);
  });

  it("builds fallback alert routes from trusted contacts", () => {
    const contacts: TrustedContact[] = [
      trustedContact({ contactType: "owner", id: "owner", name: "Owner", phone: "+15550100", preferredChannel: "sms" }),
      trustedContact({ contactType: "front_desk", id: "host", name: "Host", phone: "+15550200", preferredChannel: "sms" }),
      trustedContact({ contactType: "billing", id: "billing", name: "Billing", email: "billing@example.com", preferredChannel: "email" }),
    ];

    const complaint = resolveTrustedContactAlertRoute({ contacts, kind: "complaint", severity: "high" });
    expect(complaint.smsRecipients.map((recipient) => recipient.id)).toEqual(["owner"]);

    const order = resolveTrustedContactAlertRoute({ contacts, kind: "order", severity: "medium" });
    expect(order.smsRecipients.map((recipient) => recipient.id)).toEqual(["owner", "host"]);
  });
});

function trustedContact(input: Partial<TrustedContact> & Pick<TrustedContact, "contactType" | "id" | "name">): TrustedContact {
  return {
    canAddLiveUpdates: false,
    canApprovePermanentKnowledge: false,
    canManageAlertPreferences: false,
    canReceiveAlerts: true,
    canResolveCustomerRequests: false,
    canUseOwnerAssistant: false,
    contactType: input.contactType,
    email: input.email,
    id: input.id,
    name: input.name,
    phone: input.phone,
    preferredChannel: input.preferredChannel ?? "sms",
    requiresOwnerApproval: true,
  };
}
