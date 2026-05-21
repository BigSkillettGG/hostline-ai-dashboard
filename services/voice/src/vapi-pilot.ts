import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { CallStore, StaffTaskPriority } from "./call-store";
import type { VoiceServiceEnv } from "./env";
import { buildBusinessTranscriptionPrompt, getRuntimeBusinessProfile } from "./business-runtime";
import { buildOpenAIRealtimeTools, type OpenAIRealtimeFunctionTool } from "./openai-realtime-tools";
import { buildRestaurantInstructions } from "./restaurant-agent";
import type { RestaurantVoiceContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import { normalizeCustomerRequestKind, type CustomerRequestKind } from "../../../src/domain/business-links";

const DEFAULT_VAPI_API_BASE_URL = "https://api.vapi.ai";
const DEFAULT_VAPI_MODEL = "gpt-realtime-2025-08-28";
const DEFAULT_VAPI_VOICE_ID = "marin";
const DEFAULT_MAX_CALL_SECONDS = 600;
const VAPI_WEBHOOK_BODY_LIMIT_SECONDS = 20;

export interface VapiPilotConfig {
  allowedLocationIds: string[];
  assistantId?: string;
  assistantPreview: Record<string, unknown>;
  configured: boolean;
  enabled: boolean;
  locationId?: string;
  phoneNumberId?: string;
  ready: boolean;
  requiredEnv: Array<{ key: string; ready: boolean }>;
  serverUrl?: string;
}

export interface VapiWebhookResult {
  body: unknown;
  status: number;
}

interface VapiPilotServiceOptions {
  callStore: CallStore;
  fetchImpl?: typeof fetch;
  restaurantContextStore: RestaurantContextStore;
}

interface VapiMessageEnvelope {
  message?: Record<string, unknown>;
}

interface VapiToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

interface VapiCallSnapshot {
  id?: string;
  orgId?: string;
  customer?: {
    number?: string;
    name?: string;
  };
  phoneNumber?: {
    number?: string;
  };
}

interface VapiCallSessionState {
  callRecordId?: string;
  externalCallId: string;
  lastActivityAt: number;
  locationId?: string;
  startedAt: number;
}

export function createVapiPilotService(env: VoiceServiceEnv, options: VapiPilotServiceOptions) {
  return new VapiPilotService(env, options);
}

export function buildVapiPilotConfig(
  env: VoiceServiceEnv,
  context: RestaurantVoiceContext,
  locationId?: string,
): VapiPilotConfig {
  const serverUrl = buildVapiServerUrl(env, locationId);
  const allowedLocationIds = parseLocationAllowList(env.VAPI_PILOT_LOCATION_IDS);
  const requiredEnv = [
    { key: "PUBLIC_HTTP_BASE_URL", ready: Boolean(env.PUBLIC_HTTP_BASE_URL) },
    { key: "VAPI_API_KEY", ready: Boolean(env.VAPI_API_KEY) },
    { key: "VAPI_PILOT_ENABLED", ready: env.VAPI_PILOT_ENABLED === true },
  ];
  const configured = requiredEnv.slice(0, 2).every((item) => item.ready);
  const enabled = env.VAPI_PILOT_ENABLED === true;
  const assistantPreview = buildVapiAssistantDraft({ context, env, locationId });

  return {
    allowedLocationIds,
    assistantId: env.VAPI_PILOT_ASSISTANT_ID,
    assistantPreview,
    configured,
    enabled,
    locationId,
    phoneNumberId: env.VAPI_PILOT_PHONE_NUMBER_ID,
    ready: configured && enabled && isVapiLocationAllowed(locationId, allowedLocationIds),
    requiredEnv,
    serverUrl,
  };
}

export function buildVapiAssistantDraft({
  context,
  env,
  locationId,
}: {
  context: RestaurantVoiceContext;
  env: VoiceServiceEnv;
  locationId?: string;
}) {
  const profile = getRuntimeBusinessProfile(context);
  const model = env.VAPI_OPENAI_MODEL ?? DEFAULT_VAPI_MODEL;
  const isRealtimeModel = isVapiRealtimeModel(model);
  const tools = buildVapiTools(buildOpenAIRealtimeTools(context));
  const serverUrl = buildVapiServerUrl(env, locationId);
  const serverHeaders = env.VAPI_WEBHOOK_SECRET
    ? {
        Authorization: `Bearer ${env.VAPI_WEBHOOK_SECRET}`,
      }
    : undefined;

  return {
    backgroundSound: "off",
    firstMessage: context.greeting,
    firstMessageInterruptionsEnabled: false,
    firstMessageMode: "assistant-speaks-first",
    maxDurationSeconds: parsePositiveInteger(env.VAPI_MAX_CALL_SECONDS) ?? DEFAULT_MAX_CALL_SECONDS,
    model: {
      maxTokens: 220,
      messages: [
        {
          content: [
            buildRestaurantInstructions(context),
            "Vapi pilot note: use the same SignalHost operating style as the primary OpenAI SIP path.",
            "Never call a customer a lead. Internally you may classify opportunities, but speak as if they are a caller, customer, guest, or client.",
            "If the caller asks whether they reached the business, answer yes and continue naturally.",
          ].join("\n"),
          role: "system",
        },
      ],
      model,
      provider: "openai",
      temperature: 0.45,
      tools,
    },
    name: compactAssistantName(`SignalHost ${context.restaurantName}`),
    server: serverUrl
      ? {
          headers: serverHeaders,
          timeoutSeconds: VAPI_WEBHOOK_BODY_LIMIT_SECONDS,
          url: serverUrl,
        }
      : undefined,
    serverMessages: [
      "assistant-request",
      "status-update",
      "transcript",
      "tool-calls",
      "end-of-call-report",
      "hang",
      "user-interrupted",
    ],
    serverUrl,
    ...(!isRealtimeModel
      ? {
          transcriber: {
            keytermsPrompt: [
              context.restaurantName,
              context.hostName,
              profile.businessNoun,
              ...context.menuHighlights.slice(0, 12),
            ],
            language: "en-US",
            model: "nova-3",
            provider: "deepgram",
          },
        }
      : {}),
    voicemailMessage: `Thanks for calling ${context.restaurantName}. Please call back or leave your name and number so the team can follow up.`,
    voice: {
      provider: "openai",
      voiceId: env.VAPI_OPENAI_VOICE_ID ?? DEFAULT_VAPI_VOICE_ID,
    },
  };
}

export class VapiPilotService {
  private readonly callSessions = new Map<string, VapiCallSessionState>();
  private readonly callStore: CallStore;
  private readonly env: VoiceServiceEnv;
  private readonly fetchImpl: typeof fetch;
  private readonly restaurantContextStore: RestaurantContextStore;

  constructor(env: VoiceServiceEnv, { callStore, fetchImpl = fetch, restaurantContextStore }: VapiPilotServiceOptions) {
    this.callStore = callStore;
    this.env = env;
    this.fetchImpl = fetchImpl;
    this.restaurantContextStore = restaurantContextStore;
  }

  get configured() {
    return Boolean(this.env.VAPI_API_KEY && this.env.PUBLIC_HTTP_BASE_URL);
  }

  async getConfig(locationId?: string) {
    const context = await this.restaurantContextStore.getContext(locationId);
    return buildVapiPilotConfig(this.env, context, locationId);
  }

  async syncAssistant({ assistantId, locationId }: { assistantId?: string; locationId?: string }) {
    if (!this.env.VAPI_API_KEY) {
      throw new Error("VAPI_API_KEY is not configured.");
    }
    const context = await this.restaurantContextStore.getContext(locationId);
    const assistant = buildVapiAssistantDraft({ context, env: this.env, locationId });
    const baseUrl = (this.env.VAPI_API_BASE_URL ?? DEFAULT_VAPI_API_BASE_URL).replace(/\/$/, "");
    const targetAssistantId = assistantId?.trim() || this.env.VAPI_PILOT_ASSISTANT_ID?.trim();
    const url = targetAssistantId
      ? `${baseUrl}/assistant/${encodeURIComponent(targetAssistantId)}`
      : `${baseUrl}/assistant`;
    const method = targetAssistantId ? "PATCH" : "POST";

    const response = await this.fetchImpl(url, {
      body: JSON.stringify(assistant),
      headers: {
        Authorization: `Bearer ${this.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method,
    });
    const body = await readResponseBody(response);
    if (!response.ok) {
      throw new Error(`Vapi assistant sync failed (${response.status}): ${compactErrorBody(body)}`);
    }

    return {
      assistant,
      method,
      response: body,
      status: response.status,
    };
  }

  async handleWebhook({
    headers,
    locationId,
    rawBody,
  }: {
    headers: IncomingHttpHeaders;
    locationId?: string;
    rawBody: string;
  }): Promise<VapiWebhookResult> {
    if (!this.isAuthorized(headers, rawBody)) {
      return { body: { error: "Unauthorized" }, status: 401 };
    }

    let payload: VapiMessageEnvelope;
    try {
      payload = JSON.parse(rawBody) as VapiMessageEnvelope;
    } catch {
      return { body: { error: "Invalid JSON" }, status: 400 };
    }

    const message = payload.message ?? {};
    const type = stringValue(message.type);
    const call = message.call as VapiCallSnapshot | undefined;
    const resolvedLocationId = resolveLocationId(message, locationId);
    const availability = this.getPilotAvailability(resolvedLocationId);
    if (!availability.allowed) {
      return { body: { error: availability.reason }, status: availability.status };
    }

    const externalCallId = stringValue(call?.id) ?? stringValue(message.callId) ?? stringValue(message.id) ?? "vapi_unknown";
    const session = await this.getOrCreateSession({ call, externalCallId, locationId: resolvedLocationId, message });

    if (type === "assistant-request") {
      const context = await this.restaurantContextStore.getContext(resolvedLocationId);
      return {
        body: {
          assistant: buildVapiAssistantDraft({ context, env: this.env, locationId: resolvedLocationId }),
        },
        status: 200,
      };
    }

    if (type === "tool-calls" || type === "function-call") {
      const toolCalls = extractToolCalls(message);
      const results = [];
      for (const toolCall of toolCalls) {
        results.push(await this.handleToolCall({ locationId: resolvedLocationId, session, toolCall }));
      }
      return { body: { results }, status: 200 };
    }

    await this.persistInformationalEvent({ message, resolvedLocationId, session, type });
    return { body: { ok: true }, status: 200 };
  }

  private isAuthorized(headers: IncomingHttpHeaders, rawBody: string) {
    if (!this.env.VAPI_WEBHOOK_SECRET) return true;

    const expectedBearer = `Bearer ${this.env.VAPI_WEBHOOK_SECRET}`;
    if (firstHeader(headers.authorization) === expectedBearer) return true;
    if (firstHeader(headers["x-vapi-secret"]) === this.env.VAPI_WEBHOOK_SECRET) return true;

    const signature = firstHeader(headers["x-vapi-signature"]) ?? firstHeader(headers["x-signature"]);
    if (!signature) return false;
    const digest = createHmac("sha256", this.env.VAPI_WEBHOOK_SECRET).update(rawBody).digest("hex");
    return safeEqual(signature.replace(/^sha256=/i, ""), digest);
  }

  private getPilotAvailability(locationId?: string) {
    if (this.env.VAPI_PILOT_ENABLED !== true) {
      return {
        allowed: false,
        reason: "Vapi pilot is disabled.",
        status: 404,
      };
    }

    const allowedLocationIds = parseLocationAllowList(this.env.VAPI_PILOT_LOCATION_IDS);
    if (!isVapiLocationAllowed(locationId, allowedLocationIds)) {
      return {
        allowed: false,
        reason: "Location is not enabled for the Vapi pilot.",
        status: 403,
      };
    }

    return {
      allowed: true,
      status: 200,
    };
  }

  private async getOrCreateSession({
    call,
    externalCallId,
    locationId,
    message,
  }: {
    call?: VapiCallSnapshot;
    externalCallId: string;
    locationId?: string;
    message: Record<string, unknown>;
  }) {
    const existing = this.callSessions.get(externalCallId);
    if (existing) {
      existing.lastActivityAt = Date.now();
      return existing;
    }

    const startedAt = Date.now();
    const startResult = await this.callStore.startRealtimeCall({
      callerName: stringValue(call?.customer?.name),
      callerPhone: stringValue(call?.customer?.number) ?? stringValue(message.customerNumber),
      externalCallId,
      externalSessionId: stringValue(message.sessionId) ?? stringValue(message.chatId),
      locationId,
      provider: "vapi_pilot",
      providerPayload: {
        call,
        provider: "vapi_pilot",
      },
    });
    const session: VapiCallSessionState = {
      callRecordId: startResult.callId,
      externalCallId,
      lastActivityAt: startedAt,
      locationId,
      startedAt,
    };
    this.callSessions.set(externalCallId, session);
    return session;
  }

  private async persistInformationalEvent({
    message,
    resolvedLocationId,
    session,
    type,
  }: {
    message: Record<string, unknown>;
    resolvedLocationId?: string;
    session: VapiCallSessionState;
    type?: string;
  }) {
    if (type?.startsWith("transcript")) {
      if (stringValue(message.transcriptType)?.toLowerCase() === "partial") return;
      const text = stringValue(message.transcript) ?? stringValue(message.text);
      if (text) {
        await this.callStore.addTranscriptTurn({
          callId: session.callRecordId,
          offsetSeconds: elapsedSeconds(session.startedAt),
          speaker: normalizeVapiSpeaker(message.role),
          text,
        });
      }
      return;
    }

    if (type === "end-of-call-report") {
      await this.persistEndOfCall({ message, resolvedLocationId, session });
      this.callSessions.delete(session.externalCallId);
      return;
    }

    if (type === "status-update" && stringValue(message.status) === "ended") {
      await this.callStore.completeCall({
        callId: session.callRecordId,
        durationSeconds: elapsedSeconds(session.startedAt),
        externalCallSid: session.externalCallId,
        outcome: "vapi_status_ended",
        status: "resolved",
      });
      this.callSessions.delete(session.externalCallId);
    }
  }

  private async persistEndOfCall({
    message,
    resolvedLocationId,
    session,
  }: {
    message: Record<string, unknown>;
    resolvedLocationId?: string;
    session: VapiCallSessionState;
  }) {
    const artifact = message.artifact as Record<string, unknown> | undefined;
    const messages = Array.isArray(artifact?.messages) ? artifact.messages : [];
    for (const item of messages) {
      const turn = item as Record<string, unknown>;
      const text = stringValue(turn.message) ?? stringValue(turn.content);
      if (!text) continue;
      await this.callStore.addTranscriptTurn({
        callId: session.callRecordId,
        offsetSeconds: elapsedSeconds(session.startedAt),
        speaker: normalizeVapiSpeaker(turn.role),
        text,
      });
    }

    const recording = artifact?.recording as Record<string, unknown> | undefined;
    const recordingUrl =
      stringValue(recording?.stereoUrl) ??
      stringValue(recording?.monoUrl) ??
      stringValue(recording?.url) ??
      stringValue(artifact?.recordingUrl);
    if (recordingUrl) {
      await this.callStore.attachCallRecording({
        callId: session.callRecordId,
        externalCallSid: session.externalCallId,
        providerPayload: { provider: "vapi_pilot", recording },
        recordingUrl,
      });
    }

    await this.callStore.completeCall({
      callId: session.callRecordId,
      durationSeconds: elapsedSeconds(session.startedAt),
      externalCallSid: session.externalCallId,
      outcome: stringValue(message.endedReason) ?? "vapi_end_of_call",
      recordingUrl,
      status: "resolved",
      summary: stringValue(message.summary) ?? summarizeTranscriptText(stringValue(artifact?.transcript)),
    });
  }

  private async handleToolCall({
    locationId,
    session,
    toolCall,
  }: {
    locationId?: string;
    session: VapiCallSessionState;
    toolCall: VapiToolCall;
  }) {
    try {
      const result = await this.executeTool({ locationId, session, toolCall });
      return {
        name: toolCall.name,
        result: JSON.stringify(result),
        toolCallId: toolCall.id,
      };
    } catch (error) {
      return {
        name: toolCall.name,
        result: JSON.stringify({
          error: error instanceof Error ? error.message : "Tool failed",
          ok: false,
        }),
        toolCallId: toolCall.id,
      };
    }
  }

  private async executeTool({
    locationId,
    session,
    toolCall,
  }: {
    locationId?: string;
    session: VapiCallSessionState;
    toolCall: VapiToolCall;
  }) {
    const args = toolCall.parameters;
    const context = await this.restaurantContextStore.getContext(locationId);

    if (toolCall.name === "lookup_restaurant_context" || toolCall.name === "lookup_business_context") {
      return {
        ok: true,
        context: buildLookupContext(context, stringValue(args.topic)),
      };
    }

    if (toolCall.name === "create_customer_request") {
      const requestType = normalizeCustomerRequestKind(stringValue(args.request_type)) ?? "general";
      const result = await this.callStore.createCustomerRequest({
        callId: session.callRecordId,
        customerName: stringValue(args.caller_name),
        customerPhone: stringValue(args.callback_phone),
        details: normalizeDetails(args.details, {
          addressStatus: stringValue(args.address_status),
          formattedAddress: stringValue(args.formatted_address),
          googleMapsUri: stringValue(args.google_maps_uri),
          googlePlaceId: stringValue(args.google_place_id),
          latitude: numberValue(args.address_latitude),
          longitude: numberValue(args.address_longitude),
        }),
        locationId,
        priority: normalizePriority(args.urgency),
        requestType,
        summary: stringValue(args.summary) ?? "Caller needs staff follow-up.",
      });
      return { ok: true, ...result };
    }

    if (toolCall.name === "create_reservation_request") {
      const result = await this.callStore.createStaffReviewReservation({
        callId: session.callRecordId,
        callerPhone: stringValue(args.phone_number),
        confidence: 85,
        date: stringValue(args.reservation_date) ?? "",
        guestName: stringValue(args.guest_name) ?? "Unknown",
        locationId,
        manualRequest: true,
        notes: stringValue(args.notes),
        partySize: numberValue(args.party_size) ?? 0,
        provider: "vapi_pilot",
        status: "pending",
        time: stringValue(args.reservation_time) ?? "",
      });
      return { ok: true, ...result, status: "staff_review" };
    }

    if (toolCall.name === "request_staff_callback") {
      const priority = normalizePriority(args.urgency);
      const result = await this.callStore.createStaffTask({
        body: [
          stringValue(args.reason),
          stringValue(args.question) && `Question: ${stringValue(args.question)}`,
          stringValue(args.callback_phone) && `Callback: ${stringValue(args.callback_phone)}`,
          stringValue(args.caller_name) && `Caller: ${stringValue(args.caller_name)}`,
        ]
          .filter(Boolean)
          .join("\n"),
        callId: session.callRecordId,
        dueMinutes: priority === "urgent" ? 5 : priority === "high" ? 15 : 30,
        locationId,
        priority,
        title: `${context.restaurantName} staff callback: ${stringValue(args.kind) ?? "caller request"}`,
        type: "customer_request",
      });
      return { ok: true, ...result };
    }

    if (toolCall.name === "finish_call") {
      await this.callStore.completeCall({
        callId: session.callRecordId,
        durationSeconds: elapsedSeconds(session.startedAt),
        externalCallSid: session.externalCallId,
        outcome: stringValue(args.reason) ?? "caller_done",
        status: "resolved",
        summary: stringValue(args.closing_line),
      });
      return { ok: true, endCall: true };
    }

    return {
      ok: false,
      safeCallerMessage: "I need to send that to the team for follow-up.",
      unsupportedTool: toolCall.name,
    };
  }
}

function buildVapiTools(tools: OpenAIRealtimeFunctionTool[]) {
  return tools.map((tool) => ({
    function: {
      description: tool.description,
      name: tool.name,
      parameters: tool.parameters,
    },
    type: "function",
  }));
}

function isVapiRealtimeModel(model: string) {
  return /^gpt-(?:realtime|4o.*realtime)/i.test(model);
}

function buildVapiServerUrl(env: VoiceServiceEnv, locationId?: string) {
  if (!env.PUBLIC_HTTP_BASE_URL) return undefined;
  const url = new URL("/vapi/webhook", env.PUBLIC_HTTP_BASE_URL.replace(/\/$/, ""));
  if (locationId) url.searchParams.set("locationId", locationId);
  return url.toString();
}

function buildLookupContext(context: RestaurantVoiceContext, topic?: string) {
  const profile = getRuntimeBusinessProfile(context);
  return [
    `Business: ${context.restaurantName}`,
    `SignalHost: ${context.hostName}`,
    `Vertical: ${profile.businessNoun}`,
    `Topic requested: ${topic ?? "general"}`,
    `Greeting: ${context.greeting}`,
    `Transcription hints: ${buildBusinessTranscriptionPrompt(context)}`,
    `Highlights: ${context.menuHighlights.join(", ")}`,
    `FAQs: ${context.faqs.map((faq) => `${faq.question}: ${faq.answer}`).join(" | ")}`,
    `Knowledge: ${context.knowledgeSections.map((section) => `${section.title}: ${section.body}`).join(" | ")}`,
    `Policies: ${Object.entries(context.policies).map(([key, value]) => `${key}: ${value}`).join(" | ")}`,
  ].join("\n");
}

function extractToolCalls(message: Record<string, unknown>): VapiToolCall[] {
  const toolCalls = Array.isArray(message.toolCallList) ? message.toolCallList : [];
  if (toolCalls.length) {
    return toolCalls.map(normalizeToolCall).filter((toolCall): toolCall is VapiToolCall => Boolean(toolCall));
  }

  const toolWithCallList = Array.isArray(message.toolWithToolCallList) ? message.toolWithToolCallList : [];
  return toolWithCallList
    .map((item) => {
      const wrapper = item as Record<string, unknown>;
      const call = wrapper.toolCall as Record<string, unknown> | undefined;
      return normalizeToolCall({
        id: call?.id,
        name: wrapper.name ?? call?.name,
        parameters: call?.parameters,
      });
    })
    .filter((toolCall): toolCall is VapiToolCall => Boolean(toolCall));
}

function normalizeToolCall(value: unknown): VapiToolCall | undefined {
  const record = value as Record<string, unknown>;
  const id = stringValue(record.id) ?? stringValue(record.toolCallId);
  const name = stringValue(record.name) ?? stringValue(record.functionName);
  const parameters = parseParameters(record.parameters ?? record.arguments);
  if (!id || !name) return undefined;
  return { id, name, parameters };
}

function parseParameters(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeDetails(details: unknown, addressDetails: Record<string, unknown>) {
  const base = typeof details === "object" && details ? details as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries({ ...base, ...addressDetails }).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function normalizePriority(value: unknown): StaffTaskPriority {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === "urgent" || normalized === "high" || normalized === "low") return normalized;
  if (normalized === "medium") return "normal";
  return "normal";
}

function normalizeVapiSpeaker(role: unknown) {
  const normalized = stringValue(role)?.toLowerCase();
  if (normalized === "user" || normalized === "customer" || normalized === "caller") return "caller";
  return "agent";
}

function resolveLocationId(message: Record<string, unknown>, fallback?: string) {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const call = message.call as Record<string, unknown> | undefined;
  const callMetadata = call?.metadata as Record<string, unknown> | undefined;
  return (
    fallback ??
    stringValue(metadata?.locationId) ??
    stringValue(metadata?.location_id) ??
    stringValue(callMetadata?.locationId) ??
    stringValue(callMetadata?.location_id)
  );
}

function summarizeTranscriptText(transcript?: string) {
  if (!transcript) return undefined;
  const compact = transcript.replace(/\s+/g, " ").trim();
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text };
  }
}

function compactErrorBody(body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

function compactAssistantName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 40);
}

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseLocationAllowList(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isVapiLocationAllowed(locationId: string | undefined, allowedLocationIds: string[]) {
  return allowedLocationIds.length === 0 || Boolean(locationId && allowedLocationIds.includes(locationId));
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function elapsedSeconds(startedAt: number) {
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}
