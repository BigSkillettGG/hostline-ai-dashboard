import type { TrustedContact } from "./trusted-contacts";

export type AlertRouteKind =
  | "complaint"
  | "delivery_failure"
  | "handoff"
  | "low_confidence"
  | "order"
  | "reservation"
  | "sales";

export type AlertChannel = "sms" | "email" | "both";
export type AlertSeverity = "low" | "medium" | "high";

export interface AlertRecipient {
  channel: AlertChannel;
  email: string;
  id: string;
  name: string;
  phone: string;
}

export interface AlertRouteRule {
  enabled: boolean;
  quietHoursEnabled: boolean;
  recipients: AlertRecipient[];
  severityThreshold: AlertSeverity;
}

export interface AlertRoutingConfig {
  routes: Record<AlertRouteKind, AlertRouteRule>;
  updatedAt?: string;
}

export interface AlertRouteMeta {
  description: string;
  kind: AlertRouteKind;
  label: string;
}

export interface ResolvedAlertRoute {
  emailRecipients: AlertRecipient[];
  enabled: boolean;
  recipients: AlertRecipient[];
  smsRecipients: AlertRecipient[];
}

export interface TrustedContactAlertRouteInput {
  contacts: TrustedContact[];
  kind: AlertRouteKind;
  severity?: AlertSeverity;
}

export const alertRouteMetas: AlertRouteMeta[] = [
  {
    description: "Upset callers, refund risk, wrong orders, or manager requests about a service issue.",
    kind: "complaint",
    label: "Complaints",
  },
  {
    description: "Caller asks for a person, owner, manager, or a callback outside a specific complaint.",
    kind: "handoff",
    label: "Human handoff",
  },
  {
    description: "New phone pickup orders captured by Vera and ready for staff review.",
    kind: "order",
    label: "Phone orders",
  },
  {
    description: "Manual reservation requests that need staff confirmation or special handling.",
    kind: "reservation",
    label: "Reservations",
  },
  {
    description: "Orders that fail to reach the tablet, printer, or future POS destination.",
    kind: "delivery_failure",
    label: "Delivery failures",
  },
  {
    description: "Calls where confidence is too low and staff should review the transcript.",
    kind: "low_confidence",
    label: "Low confidence",
  },
  {
    description: "Vendor, supplier, and sales calls that should be logged without interrupting staff.",
    kind: "sales",
    label: "Sales / vendors",
  },
];

const severityRank: Record<AlertSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const defaultRecipients: Record<AlertRouteKind, AlertRecipient[]> = {
  complaint: [
    {
      channel: "both",
      email: "maria@oliveandember.com",
      id: "complaint_owner",
      name: "Maria Lombardi",
      phone: "+1 415-555-0148",
    },
  ],
  delivery_failure: [
    {
      channel: "sms",
      email: "",
      id: "delivery_manager",
      name: "Manager on duty",
      phone: "+1 415-555-0148",
    },
  ],
  handoff: [
    {
      channel: "sms",
      email: "",
      id: "handoff_manager",
      name: "Manager on duty",
      phone: "+1 415-555-0148",
    },
  ],
  low_confidence: [
    {
      channel: "email",
      email: "owner@oliveandember.com",
      id: "qa_owner",
      name: "Owner",
      phone: "",
    },
  ],
  order: [
    {
      channel: "sms",
      email: "",
      id: "order_counter",
      name: "Counter lead",
      phone: "+1 415-555-0148",
    },
  ],
  reservation: [
    {
      channel: "both",
      email: "reservations@oliveandember.com",
      id: "reservation_host",
      name: "Host stand",
      phone: "+1 415-555-0148",
    },
  ],
  sales: [
    {
      channel: "email",
      email: "owner@oliveandember.com",
      id: "sales_owner",
      name: "Owner",
      phone: "",
    },
  ],
};

export const defaultAlertRoutingConfig: AlertRoutingConfig = {
  routes: Object.fromEntries(
    alertRouteMetas.map((route) => [
      route.kind,
      {
        enabled: true,
        quietHoursEnabled: route.kind === "sales" || route.kind === "low_confidence",
        recipients: defaultRecipients[route.kind],
        severityThreshold: route.kind === "complaint" || route.kind === "delivery_failure" ? "low" : "medium",
      },
    ]),
  ) as Record<AlertRouteKind, AlertRouteRule>,
};

export function createEmptyRecipient(): AlertRecipient {
  return {
    channel: "sms",
    email: "",
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `recipient_${Date.now()}`,
    name: "",
    phone: "",
  };
}

export function normalizeAlertRoutingConfig(value: unknown): AlertRoutingConfig {
  if (!isObjectRecord(value)) return defaultAlertRoutingConfig;

  const rawRoutes = isObjectRecord(value.routes) ? value.routes : {};
  return {
    routes: Object.fromEntries(
      alertRouteMetas.map((route) => [
        route.kind,
        normalizeRouteRule(rawRoutes[route.kind], defaultAlertRoutingConfig.routes[route.kind]),
      ]),
    ) as Record<AlertRouteKind, AlertRouteRule>,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

export function resolveAlertRoute(
  config: AlertRoutingConfig,
  kind: AlertRouteKind,
  severity: AlertSeverity = "medium",
): ResolvedAlertRoute {
  const route = config.routes[kind] ?? defaultAlertRoutingConfig.routes[kind];
  const enabled = route.enabled && severityRank[severity] >= severityRank[route.severityThreshold];
  const recipients = enabled ? route.recipients.filter(hasAnyContact) : [];

  return {
    emailRecipients: recipients.filter((recipient) => recipient.email && (recipient.channel === "email" || recipient.channel === "both")),
    enabled,
    recipients,
    smsRecipients: recipients.filter((recipient) => recipient.phone && (recipient.channel === "sms" || recipient.channel === "both")),
  };
}

export function resolveTrustedContactAlertRoute(input: TrustedContactAlertRouteInput): ResolvedAlertRoute {
  const severity = input.severity ?? "medium";
  const defaultRoute = defaultAlertRoutingConfig.routes[input.kind];
  const enabled = severityRank[severity] >= severityRank[defaultRoute.severityThreshold];
  if (!enabled) {
    return {
      emailRecipients: [],
      enabled: false,
      recipients: [],
      smsRecipients: [],
    };
  }

  const primary = input.contacts.filter((contact) => isPrimaryContactForRoute(contact, input.kind));
  const fallback = input.contacts.filter((contact) => isFallbackAlertContact(contact));
  const recipients = dedupeRecipients((primary.length ? primary : fallback).map(alertRecipientFromTrustedContact));

  return {
    emailRecipients: recipients.filter((recipient) => recipient.email && (recipient.channel === "email" || recipient.channel === "both")),
    enabled: true,
    recipients,
    smsRecipients: recipients.filter((recipient) => recipient.phone && (recipient.channel === "sms" || recipient.channel === "both")),
  };
}

function normalizeRouteRule(value: unknown, fallback: AlertRouteRule): AlertRouteRule {
  if (!isObjectRecord(value)) return fallback;

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    quietHoursEnabled:
      typeof value.quietHoursEnabled === "boolean" ? value.quietHoursEnabled : fallback.quietHoursEnabled,
    recipients: Array.isArray(value.recipients)
      ? value.recipients.map(normalizeRecipient).filter(isAlertRecipient)
      : fallback.recipients,
    severityThreshold: normalizeSeverity(value.severityThreshold, fallback.severityThreshold),
  };
}

function normalizeRecipient(value: unknown): AlertRecipient | undefined {
  if (!isObjectRecord(value)) return undefined;

  return {
    channel: normalizeChannel(value.channel),
    email: typeof value.email === "string" ? value.email : "",
    id: typeof value.id === "string" && value.id ? value.id : createEmptyRecipient().id,
    name: typeof value.name === "string" ? value.name : "",
    phone: typeof value.phone === "string" ? value.phone : "",
  };
}

function isAlertRecipient(value: AlertRecipient | undefined): value is AlertRecipient {
  return Boolean(value);
}

function normalizeChannel(value: unknown): AlertChannel {
  return value === "email" || value === "both" || value === "sms" ? value : "sms";
}

function normalizeSeverity(value: unknown, fallback: AlertSeverity): AlertSeverity {
  return value === "low" || value === "medium" || value === "high" ? value : fallback;
}

function hasAnyContact(recipient: AlertRecipient) {
  return Boolean(recipient.phone.trim() || recipient.email.trim());
}

function isPrimaryContactForRoute(contact: TrustedContact, kind: AlertRouteKind) {
  if (!isFallbackAlertContact(contact)) return false;

  if (kind === "complaint" || kind === "delivery_failure" || kind === "low_confidence" || kind === "sales") {
    return contact.contactType === "owner" || contact.contactType === "manager";
  }

  if (kind === "handoff" || kind === "order" || kind === "reservation") {
    return contact.contactType === "owner" || contact.contactType === "manager" || contact.contactType === "front_desk";
  }

  return false;
}

function isFallbackAlertContact(contact: TrustedContact) {
  return contact.canReceiveAlerts && contact.contactType !== "billing" && Boolean(contact.phone || contact.email);
}

function alertRecipientFromTrustedContact(contact: TrustedContact): AlertRecipient {
  return {
    channel: contact.preferredChannel === "email" || contact.preferredChannel === "both" ? contact.preferredChannel : "sms",
    email: contact.email ?? "",
    id: contact.id,
    name: contact.name,
    phone: contact.phone ?? "",
  };
}

function dedupeRecipients(recipients: AlertRecipient[]) {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    if (!hasAnyContact(recipient)) return false;
    const key = [
      recipient.id,
      recipient.phone.trim().toLowerCase(),
      recipient.email.trim().toLowerCase(),
      recipient.channel,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
