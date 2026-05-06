import type { AlertRecipient, AlertRouteKind, AlertSeverity } from "./alert-routing";

export type StaffAlertEventStatus = "failed" | "sent" | "skipped";

export interface StaffAlertEvent {
  callId?: string;
  callerPhone?: string;
  channels: string[];
  createdAt: string;
  emailRecipientCount: number;
  errorMessage?: string;
  fallbackUsed: boolean;
  id: string;
  kind: AlertRouteKind;
  message: string;
  recipients: AlertRecipient[];
  sentAt?: string;
  severity: AlertSeverity;
  smsRecipientCount: number;
  status: StaffAlertEventStatus;
  summary: string;
}

export function summarizeAlertRecipients(recipients: AlertRecipient[]) {
  if (!recipients.length) return "No recipients";
  const named = recipients
    .map((recipient) => recipient.name || recipient.phone || recipient.email)
    .filter(Boolean);
  if (!named.length) return `${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`;
  if (named.length <= 2) return named.join(", ");
  return `${named.slice(0, 2).join(", ")} +${named.length - 2}`;
}

export function normalizeStaffAlertEventStatus(value: unknown): StaffAlertEventStatus {
  if (value === "failed" || value === "sent" || value === "skipped") return value;
  return "skipped";
}

export function channelsForRecipients(input: {
  emailRecipientCount: number;
  smsRecipientCount: number;
}) {
  return [
    input.smsRecipientCount > 0 ? "sms" : undefined,
    input.emailRecipientCount > 0 ? "email/webhook" : undefined,
  ].filter((channel): channel is string => Boolean(channel));
}
