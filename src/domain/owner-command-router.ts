import { classifyOwnerQuestion } from "@/domain/owner-assistant";
import { parseOwnerLiveCommand, type OwnerLiveCommand } from "@/domain/owner-live-commands";
import {
  defaultTrustedContactPermissions,
  type TrustedContact,
  type TrustedContactPermissions,
} from "@/domain/trusted-contacts";

export type OwnerCommandChannel = "dashboard" | "email" | "phone" | "sms";
export type OwnerCommandDecision = "allowed" | "approval_required" | "denied";

export interface OwnerCommandActor {
  contact?: Pick<TrustedContact, "contactType" | "email" | "name" | "phone">;
  permissions: TrustedContactPermissions;
}

export type OwnerCommandRoute =
  | {
      command: OwnerLiveCommand;
      decision: OwnerCommandDecision;
      kind: "live_command";
      reason?: string;
    }
  | {
      answer: string;
      body: string;
      decision: OwnerCommandDecision;
      kind: "knowledge_update";
      reason?: string;
      sourceQuestion: string;
      title: string;
    }
  | {
      decision: OwnerCommandDecision;
      kind: "report_query";
      question: string;
      reason?: string;
    }
  | {
      decision: "denied";
      kind: "denied";
      reason: string;
    }
  | {
      decision: "denied";
      kind: "unknown";
      reason: string;
    };

export function routeOwnerCommand(input: {
  actor?: OwnerCommandActor;
  channel?: OwnerCommandChannel;
  message: string;
  now?: Date;
}): OwnerCommandRoute {
  const message = normalizeWhitespace(input.message);
  if (!message) {
    return { decision: "denied", kind: "unknown", reason: "Empty owner command." };
  }

  const actor = input.actor ?? {
    permissions: defaultTrustedContactPermissions("owner"),
  };
  if (!actor.permissions.canUseOwnerAssistant) {
    return {
      decision: "denied",
      kind: "denied",
      reason: "This contact is not allowed to use owner assistant commands.",
    };
  }

  const liveCommand = parseOwnerLiveCommand(message, input.now);
  if (liveCommand) {
    return {
      command: liveCommand,
      decision: permissionDecision(actor.permissions.canAddLiveUpdates, actor.permissions.requiresOwnerApproval),
      kind: "live_command",
      reason: !actor.permissions.canAddLiveUpdates ? "This contact cannot add live updates." : undefined,
    };
  }

  const reportIntent = classifyOwnerQuestion(message);
  if (reportIntent !== "unknown") {
    return {
      decision: "allowed",
      kind: "report_query",
      question: message,
    };
  }

  const knowledgeFact = parsePermanentKnowledgeFact(message);
  if (knowledgeFact) {
    const canApprove = actor.permissions.canApprovePermanentKnowledge && !actor.permissions.requiresOwnerApproval;
    return {
      answer: knowledgeFact.answer,
      body: buildPermanentKnowledgeBody(knowledgeFact.answer, input.channel),
      decision: canApprove ? "allowed" : "approval_required",
      kind: "knowledge_update",
      reason: canApprove ? undefined : "This update should be reviewed before becoming permanent knowledge.",
      sourceQuestion: knowledgeFact.sourceQuestion,
      title: knowledgeFact.title,
    };
  }

  return {
    decision: "denied",
    kind: "unknown",
    reason: "I could not tell whether this is a report question, live update, or permanent knowledge.",
  };
}

export function parsePermanentKnowledgeFact(message: string) {
  const text = normalizeWhitespace(message);
  const explicit = extractExplicitKnowledge(text);
  const fact = explicit || extractDeclarativeFact(text);
  if (!fact) return null;

  const answer = ensureTerminalPunctuation(firstLetterUppercase(fact));
  const titleText = answer.replace(/[.!?]+$/g, "");

  return {
    answer,
    sourceQuestion: "Owner-provided business fact",
    title: truncateTitle(`Owner note - ${titleText}`),
  };
}

function permissionDecision(canDoThing: boolean, requiresOwnerApproval: boolean): OwnerCommandDecision {
  if (!canDoThing) return "denied";
  return requiresOwnerApproval ? "approval_required" : "allowed";
}

function extractExplicitKnowledge(text: string) {
  const patterns = [
    /^(?:remember|note|save|add to knowledge|teach signalhost|teach vera)(?:\s+that)?\s+(.+)$/i,
    /^(?:permanent note|knowledge update|for future callers)(?:\s*:|\s+that)?\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return cleanFact(match[1]);
  }

  return "";
}

function extractDeclarativeFact(text: string) {
  if (text.endsWith("?")) return "";
  if (/^(?:what|when|where|why|how|who|can you|could you|please|show me|tell me)\b/i.test(text)) return "";
  if (/\b(today|tonight|tomorrow|closed|running behind|special|busy mode|emergency mode)\b/i.test(text)) return "";
  if (!/\b(?:is|are|has|have|does|do|can|cannot|can't|allows?|accepts?|serves?|offers?|provides?)\b/i.test(text)) return "";

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 26) return "";
  return cleanFact(text);
}

function buildPermanentKnowledgeBody(answer: string, channel: OwnerCommandChannel = "dashboard") {
  return [
    `Owner-provided knowledge: ${answer}`,
    "Use this answer for future customer calls, chats, texts, and emails unless a newer live update says otherwise.",
    `Source channel: ${channel}`,
  ].join("\n\n");
}

function cleanFact(value: string) {
  return value.trim().replace(/^that\s+/i, "").replace(/\s+/g, " ");
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function firstLetterUppercase(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function ensureTerminalPunctuation(value: string) {
  if (!value) return value;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function truncateTitle(value: string) {
  return value.length <= 84 ? value : `${value.slice(0, 81).trim()}...`;
}
