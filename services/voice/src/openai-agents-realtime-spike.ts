import { OpenAIRealtimeSIP, RealtimeAgent, tool } from "@openai/agents/realtime";
import type { FunctionTool } from "@openai/agents";
import type { VoiceServiceEnv } from "./env";
import type { OpenAIRealtimeFunctionTool } from "./openai-realtime-tools";
import { buildOpenAIRealtimeAcceptPayload, buildOpenAIRealtimeLiveCallConfig } from "./openai-realtime-sip";
import type { RestaurantVoiceContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import type { TrustedContact } from "../../../src/domain/trusted-contacts";

type LegacyTurnDetection = ReturnType<typeof buildOpenAIRealtimeAcceptPayload>["audio"]["input"]["turn_detection"];

export interface OpenAIAgentsRealtimeAcceptInput {
  callerPhone?: string;
  context: RestaurantVoiceContext;
  env: VoiceServiceEnv;
  now?: Date;
  ownerContact?: TrustedContact;
}

export interface OpenAIAgentsRealtimePreflight {
  checks: Array<{
    detail: string;
    id: string;
    label: string;
    ready: boolean;
    required: boolean;
  }>;
  comparison: {
    customAccept: OpenAIAgentsRealtimePayloadSummary;
    sdkAccept: OpenAIAgentsRealtimePayloadSummary;
  };
  locationId: string;
  omittedTurnDetectionFields: string[];
  ready: boolean;
  restaurantName?: string;
  sdkConfigured: boolean;
}

export interface OpenAIAgentsRealtimePayloadSummary {
  hasInstructions: boolean;
  instructionPreview: string;
  maxOutputTokens?: number;
  model: string;
  noiseReduction?: unknown;
  outputModalities?: unknown;
  toolNames: string[];
  turnDetection?: unknown;
  type?: unknown;
  voice?: string;
}

export async function buildOpenAIAgentsRealtimeAcceptPayload({
  callerPhone,
  context,
  env,
  now,
  ownerContact,
}: OpenAIAgentsRealtimeAcceptInput) {
  const currentPayload = buildOpenAIRealtimeAcceptPayload({ callerPhone, context, env, now, ownerContact });
  const sdkTools = currentPayload.tools.map(toAgentsSdkTool);
  const agent = new RealtimeAgent({
    instructions: currentPayload.instructions,
    name: ownerContact ? "SignalHost Owner Assistant" : "SignalHost Front Desk",
    tools: sdkTools,
    voice: currentPayload.audio.output.voice,
  });

  return OpenAIRealtimeSIP.buildInitialConfig(agent, {
    apiKey: env.OPENAI_API_KEY || "sk-missing",
    config: {
      audio: {
        input: {
          noiseReduction: currentPayload.audio.input.noise_reduction,
          transcription: currentPayload.audio.input.transcription,
          turnDetection: toSipSdkTurnDetection(currentPayload.audio.input.turn_detection),
        },
        output: currentPayload.audio.output,
      },
      outputModalities: currentPayload.output_modalities,
      toolChoice: currentPayload.tool_choice,
    },
    model: currentPayload.model,
    transport: new OpenAIRealtimeSIP(),
  });
}

export async function buildOpenAIAgentsRealtimePreflight({
  callerPhone,
  env,
  locationId,
  now,
  ownerContact,
  restaurantContextStore,
}: {
  callerPhone?: string;
  env: VoiceServiceEnv;
  locationId?: string;
  now?: Date;
  ownerContact?: TrustedContact;
  restaurantContextStore: RestaurantContextStore;
}): Promise<OpenAIAgentsRealtimePreflight> {
  const resolvedLocationId = locationId?.trim() || env.SUPABASE_DEMO_LOCATION_ID || "demo-location";
  const checks: OpenAIAgentsRealtimePreflight["checks"] = [
    {
      detail: "Needed to build and eventually run OpenAI Agents SDK Realtime SIP sessions.",
      id: "openai_api_key",
      label: "OpenAI API key",
      ready: Boolean(env.OPENAI_API_KEY),
      required: true,
    },
    {
      detail: "Needed so OpenAI can send incoming-call webhooks to the voice service.",
      id: "public_http_base_url",
      label: "Public voice URL",
      ready: Boolean(env.PUBLIC_HTTP_BASE_URL),
      required: true,
    },
  ];

  let context: RestaurantVoiceContext | undefined;
  try {
    context = await restaurantContextStore.getContext(resolvedLocationId);
    checks.push({
      detail: `Loaded voice context for ${context.restaurantName}.`,
      id: "business_context",
      label: "Business context",
      ready: true,
      required: true,
    });
  } catch (error) {
    checks.push({
      detail: error instanceof Error ? error.message : "Could not load business context.",
      id: "business_context",
      label: "Business context",
      ready: false,
      required: true,
    });
  }

  if (!context) {
    const config = buildOpenAIRealtimeLiveCallConfig(env, resolvedLocationId);
    return {
      checks,
      comparison: {
        customAccept: {
          hasInstructions: false,
          instructionPreview: "",
          model: config.model,
          toolNames: [],
          turnDetection: config.turnDetection,
          type: "realtime",
          voice: config.voice,
        },
        sdkAccept: {
          hasInstructions: false,
          instructionPreview: "",
          model: config.model,
          toolNames: [],
          turnDetection: toSipSdkTurnDetection(config.turnDetection),
          type: "realtime",
          voice: config.voice,
        },
      },
      locationId: resolvedLocationId,
      omittedTurnDetectionFields: findUnsupportedSipTurnDetectionFields(config.turnDetection),
      ready: false,
      sdkConfigured: Boolean(env.OPENAI_API_KEY && env.PUBLIC_HTTP_BASE_URL),
    };
  }

  const customPayload = buildOpenAIRealtimeAcceptPayload({ callerPhone, context, env, now, ownerContact });
  const sdkPayload = await buildOpenAIAgentsRealtimeAcceptPayload({ callerPhone, context, env, now, ownerContact });

  return {
    checks,
    comparison: {
      customAccept: summarizePayload(customPayload),
      sdkAccept: summarizePayload(sdkPayload),
    },
    locationId: resolvedLocationId,
    omittedTurnDetectionFields: findUnsupportedSipTurnDetectionFields(customPayload.audio.input.turn_detection),
    ready: checks.filter((check) => check.required).every((check) => check.ready),
    restaurantName: context.restaurantName,
    sdkConfigured: Boolean(env.OPENAI_API_KEY && env.PUBLIC_HTTP_BASE_URL),
  };
}

export function toSipSdkTurnDetection(turnDetection: LegacyTurnDetection) {
  if (turnDetection.type === "semantic_vad") {
    return {
      createResponse: turnDetection.create_response,
      eagerness: turnDetection.eagerness,
      interruptResponse: turnDetection.interrupt_response,
      type: turnDetection.type,
    };
  }

  return {
    createResponse: turnDetection.create_response,
    ...(typeof turnDetection.idle_timeout_ms === "number" ? { idleTimeoutMs: turnDetection.idle_timeout_ms } : {}),
    interruptResponse: turnDetection.interrupt_response,
    type: turnDetection.type,
  };
}

export function findUnsupportedSipTurnDetectionFields(turnDetection: LegacyTurnDetection) {
  if (turnDetection.type !== "server_vad") return [];

  return [
    typeof turnDetection.threshold === "undefined" ? undefined : "threshold",
    typeof turnDetection.prefix_padding_ms === "undefined" ? undefined : "prefix_padding_ms",
    typeof turnDetection.silence_duration_ms === "undefined" ? undefined : "silence_duration_ms",
  ].filter((field): field is string => Boolean(field));
}

function toAgentsSdkTool(legacyTool: OpenAIRealtimeFunctionTool): FunctionTool {
  return tool({
    description: legacyTool.description,
    execute: async () => JSON.stringify({
      error: "agents_sdk_preview_only",
      message: "This diagnostic SDK payload reuses SignalHost tool names, but live tool execution stays on the existing sideband path until the SDK path is explicitly enabled.",
      ok: false,
      tool: legacyTool.name,
    }),
    name: legacyTool.name,
    parameters: legacyTool.parameters as never,
    strict: false,
  });
}

function summarizePayload(payload: Record<string, any>): OpenAIAgentsRealtimePayloadSummary {
  return {
    hasInstructions: typeof payload.instructions === "string" && payload.instructions.trim().length > 0,
    instructionPreview: typeof payload.instructions === "string" ? payload.instructions.slice(0, 400) : "",
    maxOutputTokens: typeof payload.max_output_tokens === "number" ? payload.max_output_tokens : undefined,
    model: typeof payload.model === "string" ? payload.model : "",
    noiseReduction: payload.audio?.input?.noise_reduction,
    outputModalities: payload.output_modalities,
    toolNames: Array.isArray(payload.tools)
      ? payload.tools.map((payloadTool: { name?: unknown }) => payloadTool.name).filter((name): name is string => typeof name === "string")
      : [],
    turnDetection: payload.audio?.input?.turn_detection,
    type: payload.type,
    voice: typeof payload.audio?.output?.voice === "string" ? payload.audio.output.voice : undefined,
  };
}
