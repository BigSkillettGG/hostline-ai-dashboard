import {
  routeOwnerCommand,
  type OwnerCommandActor,
  type OwnerCommandChannel,
  type OwnerCommandRoute,
} from "../../../src/domain/owner-command-router";
import type { BusinessMode } from "../../../src/domain/business-updates";
import type { DailyBrief } from "../../../src/domain/daily-brief";
import type { TrustedContact } from "../../../src/domain/trusted-contacts";
import { buildSupabaseServiceHeaders } from "./supabase-headers";
import type { VoiceServiceEnv } from "./env";
import type { OwnerReportService } from "./owner-report-service";

export interface OwnerCommandRuntime {
  configured: boolean;
  runCommand(input: OwnerCommandRuntimeInput): Promise<OwnerCommandToolResult>;
}

export interface OwnerCommandRuntimeInput {
  actor: TrustedContact;
  channel: OwnerCommandChannel;
  locationId: string;
  message: string;
  now?: Date;
}

export interface OwnerCommandToolResult {
  applied?: boolean;
  bullets?: string[];
  decision: string;
  kind: string;
  message: string;
  ok: boolean;
  spokenResponse: string;
  title: string;
}

interface SupabaseKnowledgeSuggestionRow {
  id: string;
}

interface SupabaseKnowledgeSectionRow {
  id: string;
}

export function createOwnerCommandRuntime(
  env: VoiceServiceEnv,
  ownerReportService?: OwnerReportService,
): OwnerCommandRuntime {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID) {
    return new SupabaseOwnerCommandRuntime(env, ownerReportService);
  }

  return new NoopOwnerCommandRuntime(ownerReportService);
}

class NoopOwnerCommandRuntime implements OwnerCommandRuntime {
  configured = false;

  constructor(private readonly ownerReportService?: OwnerReportService) {}

  async runCommand(input: OwnerCommandRuntimeInput): Promise<OwnerCommandToolResult> {
    const route = routeOwnerCommand({
      actor: buildOwnerCommandActor(input.actor),
      channel: input.channel,
      message: input.message,
      now: input.now,
    });

    if (route.kind === "report_query" && this.ownerReportService?.configured) {
      const result = await this.ownerReportService.generateDailyReport({
        locationId: input.locationId,
        now: input.now,
      });
      return ownerReportToolResult(route, result.report);
    }

    return {
      applied: false,
      decision: route.decision,
      kind: route.kind,
      message: "Owner command persistence is not configured on the voice service.",
      ok: false,
      spokenResponse: "I understood that, but I cannot save or look that up until Supabase is connected to the voice service.",
      title: "Owner command unavailable",
    };
  }
}

class SupabaseOwnerCommandRuntime implements OwnerCommandRuntime {
  configured = true;
  private readonly defaultLocationId: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor(env: VoiceServiceEnv, private readonly ownerReportService?: OwnerReportService) {
    this.defaultLocationId = env.SUPABASE_DEMO_LOCATION_ID ?? "";
    this.key = env.SUPABASE_SECRET_KEY ?? "";
    this.restUrl = `${env.SUPABASE_URL?.replace(/\/$/, "")}/rest/v1`;
  }

  async runCommand(input: OwnerCommandRuntimeInput): Promise<OwnerCommandToolResult> {
    const locationId = input.locationId || this.defaultLocationId;
    const route = routeOwnerCommand({
      actor: buildOwnerCommandActor(input.actor),
      channel: input.channel,
      message: input.message,
      now: input.now,
    });

    if (route.kind === "report_query") {
      if (!this.ownerReportService?.configured) {
        return {
          applied: false,
          decision: route.decision,
          kind: route.kind,
          message: "Owner report service is not configured.",
          ok: false,
          spokenResponse: "I can take updates, but I cannot read today's report from the database yet.",
          title: "Report unavailable",
        };
      }
      const result = await this.ownerReportService.generateDailyReport({
        locationId,
        now: input.now,
      });
      return ownerReportToolResult(route, result.report);
    }

    if (route.kind === "live_command") {
      return this.runLiveCommand(route, locationId);
    }

    if (route.kind === "knowledge_update") {
      return this.runKnowledgeCommand(route, locationId);
    }

    return {
      applied: false,
      decision: route.decision,
      kind: route.kind,
      message: route.reason,
      ok: false,
      spokenResponse: "I am not sure whether that is a report question, live update, or permanent knowledge update.",
      title: "Command unclear",
    };
  }

  private async runLiveCommand(
    route: Extract<OwnerCommandRoute, { kind: "live_command" }>,
    locationId: string,
  ): Promise<OwnerCommandToolResult> {
    if (route.decision === "denied") {
      return deniedToolResult(route.kind, route.reason ?? "This contact cannot add live updates.");
    }

    if (route.decision === "approval_required") {
      return {
        applied: false,
        decision: route.decision,
        kind: route.kind,
        message: "Tell the manager this update needs owner approval before it changes caller behavior.",
        ok: true,
        spokenResponse: "I understood that update, but it needs owner approval before I change what callers hear.",
        title: "Owner approval required",
      };
    }

    if (route.command.kind === "set_mode") {
      await this.request("business_live_settings", {
        body: {
          active_mode: route.command.mode,
          location_id: locationId,
          updated_at: new Date().toISOString(),
        },
        headers: { Prefer: "return=representation,resolution=merge-duplicates" },
        method: "POST",
        query: "on_conflict=location_id&select=location_id",
      });

      return {
        applied: true,
        bullets: [`Mode: ${formatBusinessMode(route.command.mode)}`],
        decision: route.decision,
        kind: route.kind,
        message: `Tell the owner: ${route.command.confirmation}`,
        ok: true,
        spokenResponse: route.command.confirmation,
        title: "Business mode updated",
      };
    }

    await this.request("business_live_updates", {
      body: {
        body: route.command.update.body,
        expires_at: route.command.update.expiresAt ?? null,
        expiration: route.command.update.expiration,
        location_id: locationId,
        mode: route.command.update.mode ?? null,
        source: "owner_text",
        title: route.command.update.title,
        update_type: route.command.update.type,
      },
      headers: { Prefer: "return=representation" },
      method: "POST",
      query: "select=id",
    });

    return {
      applied: true,
      bullets: [route.command.update.body],
      decision: route.decision,
      kind: route.kind,
      message: `Tell the owner: ${route.command.confirmation}`,
      ok: true,
      spokenResponse: route.command.confirmation,
      title: "Live update saved",
    };
  }

  private async runKnowledgeCommand(
    route: Extract<OwnerCommandRoute, { kind: "knowledge_update" }>,
    locationId: string,
  ): Promise<OwnerCommandToolResult> {
    const suggestion = await this.createKnowledgeSuggestion(route, locationId);

    if (route.decision === "approval_required") {
      return {
        applied: false,
        bullets: [route.answer],
        decision: route.decision,
        kind: route.kind,
        message: "Tell the manager this was saved for owner approval before customers hear it.",
        ok: true,
        spokenResponse: "Got it. I saved that for owner approval before I use it with customers.",
        title: "Knowledge pending approval",
      };
    }

    const section = await this.request<SupabaseKnowledgeSectionRow[]>("knowledge_sections", {
      body: {
        body: route.body,
        is_active: true,
        location_id: locationId,
        title: route.title,
        updated_at: new Date().toISOString(),
      },
      headers: { Prefer: "return=representation" },
      method: "POST",
      query: "select=id",
    });

    await this.request("knowledge_suggestions", {
      body: {
        applied_knowledge_section_id: section[0]?.id ?? null,
        reviewed_at: new Date().toISOString(),
        status: "applied",
      },
      headers: { Prefer: "return=representation" },
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(suggestion.id)}&location_id=eq.${encodeURIComponent(locationId)}&select=id`,
    });

    return {
      applied: true,
      bullets: [route.answer],
      decision: route.decision,
      kind: route.kind,
      message: "Tell the owner this is saved as permanent knowledge for future customer conversations.",
      ok: true,
      spokenResponse: "Got it. I saved that as permanent knowledge for future customer conversations.",
      title: "Knowledge saved",
    };
  }

  private async createKnowledgeSuggestion(
    route: Extract<OwnerCommandRoute, { kind: "knowledge_update" }>,
    locationId: string,
  ) {
    const rows = await this.request<SupabaseKnowledgeSuggestionRow[]>("knowledge_suggestions", {
      body: {
        body: route.body,
        location_id: locationId,
        priority: "normal",
        source: "owner_assistant",
        source_question: route.sourceQuestion,
        status: route.decision === "approval_required" ? "pending" : "applied",
        suggested_answer: route.answer,
        title: route.title,
      },
      headers: { Prefer: "return=representation" },
      method: "POST",
      query: "select=id",
    });
    if (!rows[0]?.id) throw new Error("Knowledge suggestion was not returned after insert.");
    return rows[0];
  }

  private async request<T = unknown>(
    table: string,
    input: {
      body?: unknown;
      headers?: Record<string, string>;
      method: "GET" | "PATCH" | "POST";
      query?: string;
    },
  ): Promise<T> {
    const response = await fetch(`${this.restUrl}/${table}${input.query ? `?${input.query}` : ""}`, {
      body: input.body ? JSON.stringify(input.body) : undefined,
      headers: {
        ...buildSupabaseServiceHeaders(this.key),
        ...(input.body ? { "Content-Type": "application/json" } : {}),
        ...(input.headers ?? {}),
      },
      method: input.method,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase ${input.method} ${table} failed: ${response.status} ${body}`);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

function buildOwnerCommandActor(contact: TrustedContact): OwnerCommandActor {
  return {
    contact: {
      contactType: contact.contactType,
      email: contact.email,
      name: contact.name,
      phone: contact.phone,
    },
    permissions: {
      canAddLiveUpdates: contact.canAddLiveUpdates,
      canApprovePermanentKnowledge: contact.canApprovePermanentKnowledge,
      canManageAlertPreferences: contact.canManageAlertPreferences,
      canReceiveAlerts: contact.canReceiveAlerts,
      canResolveCustomerRequests: contact.canResolveCustomerRequests,
      canUseOwnerAssistant: contact.canUseOwnerAssistant,
      requiresOwnerApproval: contact.requiresOwnerApproval,
    },
  };
}

function ownerReportToolResult(route: Extract<OwnerCommandRoute, { kind: "report_query" }>, report: DailyBrief): OwnerCommandToolResult {
  const question = route.question.toLowerCase();
  const response = formatOwnerReportResponse(report, question);

  return {
    applied: false,
    bullets: response.bullets,
    decision: route.decision,
    kind: route.kind,
    message: `Tell the owner: ${response.spokenResponse}`,
    ok: true,
    spokenResponse: response.spokenResponse,
    title: response.title,
  };
}

function formatOwnerReportResponse(report: DailyBrief, question: string) {
  if (/\b(urgent|emergency|asap|priority)\b/.test(question)) {
    const urgentFollowUps = report.followUps.filter((item) => item.priority === "urgent").slice(0, 3);
    return {
      bullets: urgentFollowUps.map((item) => `${item.title}: ${item.action}`),
      spokenResponse: report.totals.urgent || urgentFollowUps.length
        ? `I see ${Math.max(report.totals.urgent, urgentFollowUps.length)} urgent item${Math.max(report.totals.urgent, urgentFollowUps.length) === 1 ? "" : "s"} today.`
        : "I do not see any urgent items today.",
      title: "Urgent items",
    };
  }

  if (/\b(follow up|follow-up|callback|needs attention|open task|todo|to do)\b/.test(question)) {
    const followUps = report.followUps.slice(0, 4);
    return {
      bullets: followUps.map((item) => `${item.title}: ${item.action}`),
      spokenResponse: followUps.length
        ? `There are ${followUps.length} follow-up item${followUps.length === 1 ? "" : "s"} I would handle next.`
        : "Nothing needs follow-up right now.",
      title: "Open follow-ups",
    };
  }

  if (/\b(didn't know|did not know|not know|knowledge|missing|couldn't answer|could not answer|improve)\b/.test(question)) {
    return {
      bullets: report.suggestedUpdates.slice(0, 4).map((item) => `${item.title}: ${item.detail}`),
      spokenResponse: report.suggestedUpdates.length
        ? `I found ${report.suggestedUpdates.length} possible knowledge update${report.suggestedUpdates.length === 1 ? "" : "s"}.`
        : "I do not see any obvious knowledge gaps from today's interactions.",
      title: "Knowledge to improve",
    };
  }

  return {
    bullets: [
      `${report.totals.calls} calls and ${report.totals.chats} chats`,
      `${report.totals.openFollowUps} open follow-ups`,
      `${report.totals.highValue} high-value opportunities`,
      `${report.totals.knowledgeGaps} answers to improve`,
    ],
    spokenResponse: report.ownerMessage,
    title: report.headline,
  };
}

function deniedToolResult(kind: string, reason: string): OwnerCommandToolResult {
  return {
    applied: false,
    decision: "denied",
    kind,
    message: reason,
    ok: false,
    spokenResponse: "I cannot make that change from this contact.",
    title: "Command not allowed",
  };
}

function formatBusinessMode(mode: BusinessMode) {
  return mode.replace(/_/g, " ");
}
