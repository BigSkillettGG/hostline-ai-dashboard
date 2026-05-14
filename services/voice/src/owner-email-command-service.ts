import {
  defaultTrustedContactPermissions,
  normalizeTrustedContactPreferredChannel,
  normalizeTrustedContactType,
  type TrustedContact,
} from "../../../src/domain/trusted-contacts";
import { buildSupabaseServiceHeaders } from "./supabase-headers";
import type { VoiceServiceEnv } from "./env";
import type { OwnerCommandRuntime, OwnerCommandToolResult } from "./owner-command-runtime";

export interface OwnerEmailCommandInput {
  fromEmail?: string;
  html?: string;
  locationId?: string;
  providerMessageId?: string;
  rawPayload?: Record<string, unknown>;
  subject?: string;
  text?: string;
  toEmail?: string;
}

export interface OwnerEmailCommandResult {
  contactId?: string;
  contactName?: string;
  locationId?: string;
  replyMessage: string;
  status: "ambiguous" | "invalid" | "not_found" | "processed";
  toolResult?: OwnerCommandToolResult;
}

interface SupabaseTrustedEmailContactRow {
  can_add_live_updates?: boolean | null;
  can_approve_permanent_knowledge?: boolean | null;
  can_manage_alert_preferences?: boolean | null;
  can_receive_alerts?: boolean | null;
  can_resolve_customer_requests?: boolean | null;
  can_use_owner_assistant?: boolean | null;
  contact_type?: string | null;
  created_at?: string | null;
  email?: string | null;
  id: string;
  location_id?: string | null;
  name?: string | null;
  phone?: string | null;
  preferred_channel?: string | null;
  requires_owner_approval?: boolean | null;
  trusted_identity_enabled?: boolean | null;
  updated_at?: string | null;
}

export interface OwnerEmailCommandService {
  configured: boolean;
  handleInboundEmail(input: OwnerEmailCommandInput): Promise<OwnerEmailCommandResult>;
}

export function createOwnerEmailCommandService(
  env: VoiceServiceEnv,
  ownerCommandRuntime: OwnerCommandRuntime,
): OwnerEmailCommandService {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && ownerCommandRuntime.configured) {
    return new SupabaseOwnerEmailCommandService(env, ownerCommandRuntime);
  }

  return new NoopOwnerEmailCommandService();
}

class NoopOwnerEmailCommandService implements OwnerEmailCommandService {
  configured = false;

  async handleInboundEmail(): Promise<OwnerEmailCommandResult> {
    return {
      replyMessage: "Owner email commands are not configured yet.",
      status: "invalid",
    };
  }
}

class SupabaseOwnerEmailCommandService implements OwnerEmailCommandService {
  configured = true;
  private readonly defaultLocationId?: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor(env: VoiceServiceEnv, private readonly ownerCommandRuntime: OwnerCommandRuntime) {
    this.defaultLocationId = env.SUPABASE_DEMO_LOCATION_ID;
    this.key = env.SUPABASE_SECRET_KEY ?? "";
    this.restUrl = `${env.SUPABASE_URL?.replace(/\/$/, "")}/rest/v1`;
  }

  async handleInboundEmail(input: OwnerEmailCommandInput): Promise<OwnerEmailCommandResult> {
    const fromEmail = normalizeEmail(input.fromEmail);
    const message = extractOwnerEmailCommandMessage(input);
    const requestedLocationId = normalizeLocationId(input.locationId);

    if (!fromEmail || !message) {
      return {
        replyMessage: "I need a trusted sender email and a message to process that owner command.",
        status: "invalid",
      };
    }

    const contacts = await this.findTrustedContacts(fromEmail, requestedLocationId);
    if (contacts.length === 0) {
      await this.recordEmailEvent({
        fromEmail,
        input,
        locationId: requestedLocationId,
        message,
        status: "owner_email_unknown",
        toEmail: input.toEmail,
      });
      return {
        replyMessage: "I could not match that sender to a trusted owner or manager.",
        status: "not_found",
      };
    }

    if (contacts.length > 1) {
      await this.recordEmailEvent({
        fromEmail,
        input,
        locationId: requestedLocationId,
        message,
        status: "owner_email_ambiguous",
        toEmail: input.toEmail,
      });
      return {
        replyMessage: "That trusted email is attached to more than one business. Include a locationId with the email webhook payload.",
        status: "ambiguous",
      };
    }

    const contact = contacts[0];
    const resolvedLocationId = contact.locationId ?? requestedLocationId ?? this.defaultLocationId;
    if (!resolvedLocationId) {
      return {
        replyMessage: "I matched the trusted contact, but no location is available for this command.",
        status: "invalid",
      };
    }

    await this.recordEmailEvent({
      contact,
      fromEmail,
      input,
      locationId: resolvedLocationId,
      message,
      status: "owner_email_command",
      toEmail: input.toEmail,
    });

    const toolResult = await this.ownerCommandRuntime.runCommand({
      actor: contact,
      channel: "email",
      locationId: resolvedLocationId,
      message,
    });
    const replyMessage = formatOwnerEmailReply(toolResult);

    await this.recordEmailEvent({
      contact,
      fromEmail: input.toEmail ?? "signalhost-email",
      input,
      locationId: resolvedLocationId,
      message: replyMessage,
      status: toolResult.ok ? "owner_email_reply" : "owner_email_failed",
      toEmail: fromEmail,
    });

    return {
      contactId: contact.id,
      contactName: contact.name,
      locationId: resolvedLocationId,
      replyMessage,
      status: "processed",
      toolResult,
    };
  }

  private async findTrustedContacts(email: string, locationId?: string) {
    const query = [
      `email=ilike.${encodeURIComponent(email)}`,
      "trusted_identity_enabled=eq.true",
      "can_use_owner_assistant=eq.true",
      locationId ? `location_id=eq.${encodeURIComponent(locationId)}` : undefined,
      "select=id,location_id,contact_type,name,phone,email,preferred_channel,can_receive_alerts,can_use_owner_assistant,can_add_live_updates,can_approve_permanent_knowledge,can_resolve_customer_requests,can_manage_alert_preferences,requires_owner_approval,trusted_identity_enabled,created_at,updated_at",
      "limit=5",
    ].filter(Boolean).join("&");
    const rows = await this.request<SupabaseTrustedEmailContactRow[]>("business_contacts", {
      method: "GET",
      query,
    }).catch(() => []);

    return rows.map(mapTrustedEmailContactRow).filter((contact) => contact.canUseOwnerAssistant);
  }

  private async recordEmailEvent(input: {
    contact?: TrustedContact;
    fromEmail: string;
    input: OwnerEmailCommandInput;
    locationId?: string;
    message: string;
    status: string;
    toEmail?: string;
  }) {
    const locationId = input.locationId ?? input.contact?.locationId ?? input.input.locationId ?? null;

    await this.request("message_events", {
      body: {
        body: input.message,
        direction: input.status === "owner_email_reply" || input.status === "owner_email_failed" ? "outbound" : "inbound",
        from_phone: input.fromEmail,
        location_id: locationId,
        provider: "email",
        provider_message_sid: input.input.providerMessageId ?? null,
        raw_payload: {
          contactId: input.contact?.id,
          locationId,
          rawPayload: input.input.rawPayload ?? {},
          subject: input.input.subject ?? null,
        },
        status: input.status,
        thread_id: null,
        to_phone: input.toEmail ?? input.input.toEmail ?? "signalhost-email",
      },
      method: "POST",
    }).catch((error) => {
      console.warn("[owner-email-command] email command event log failed", error);
    });
  }

  private async request<T = unknown>(
    table: string,
    input: {
      body?: unknown;
      method: "GET" | "POST";
      query?: string;
    },
  ): Promise<T> {
    const response = await fetch(`${this.restUrl}/${table}${input.query ? `?${input.query}` : ""}`, {
      body: input.body ? JSON.stringify(input.body) : undefined,
      headers: buildSupabaseServiceHeaders(this.key),
      method: input.method,
    });

    if (!response.ok) {
      throw new Error(`Supabase ${input.method} ${table} failed: ${response.status} ${await response.text()}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

export function extractOwnerEmailCommandMessage(input: OwnerEmailCommandInput) {
  const body = stripHtml(input.text || htmlToText(input.html) || "");
  const cleaned = stripQuotedEmail(body).trim();
  if (cleaned) return compactWhitespace(cleaned).slice(0, 2400);

  const subject = input.subject?.trim();
  if (!subject) return "";
  return compactWhitespace(subject.replace(/^(re|fw|fwd):\s*/i, "")).slice(0, 2400);
}

function mapTrustedEmailContactRow(row: SupabaseTrustedEmailContactRow): TrustedContact {
  const contactType = normalizeTrustedContactType(row.contact_type);
  const defaults = defaultTrustedContactPermissions(contactType);

  return {
    canAddLiveUpdates: row.can_add_live_updates ?? defaults.canAddLiveUpdates,
    canApprovePermanentKnowledge: row.can_approve_permanent_knowledge ?? defaults.canApprovePermanentKnowledge,
    canManageAlertPreferences: row.can_manage_alert_preferences ?? defaults.canManageAlertPreferences,
    canReceiveAlerts: row.can_receive_alerts ?? defaults.canReceiveAlerts,
    canResolveCustomerRequests: row.can_resolve_customer_requests ?? defaults.canResolveCustomerRequests,
    canUseOwnerAssistant: row.can_use_owner_assistant ?? defaults.canUseOwnerAssistant,
    contactType,
    createdAt: row.created_at ?? undefined,
    email: row.email ?? undefined,
    id: row.id,
    locationId: row.location_id ?? undefined,
    name: row.name?.trim() || "Owner",
    phone: row.phone ?? undefined,
    preferredChannel: normalizeTrustedContactPreferredChannel(row.preferred_channel),
    requiresOwnerApproval: row.requires_owner_approval ?? defaults.requiresOwnerApproval,
    updatedAt: row.updated_at ?? undefined,
  };
}

function formatOwnerEmailReply(result: OwnerCommandToolResult) {
  return [
    result.spokenResponse || result.message || "Done.",
    ...(result.bullets?.length ? ["", ...result.bullets.slice(0, 5).map((bullet) => `- ${bullet}`)] : []),
  ].join("\n");
}

function normalizeEmail(value?: string) {
  const email = value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim().toLowerCase();
  return email || undefined;
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

function stripQuotedEmail(value: string) {
  return value
    .split(/\n\s*On .+ wrote:\s*(?:\n|$)/i)[0]
    .split(/\n\s*-{2,}\s*Original Message\s*-{2,}\s*(?:\n|$)/i)[0]
    .split(/\n\s*From:\s.+\n\s*Sent:\s.+/i)[0]
    .trim();
}

function htmlToText(value?: string) {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
