import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { VoiceServiceEnv } from "./env";
import {
  buildOpenAIRealtimeAcceptPayload,
  buildOpenAIRealtimeInstructions,
  buildOpenAIRealtimeLiveCallConfig,
  buildOpenAIRealtimePreflight,
  extractOpenAIRealtimeCallId,
  extractOpenAIRealtimeToolCalls,
  lookupRestaurantContext,
  verifyOpenAIWebhookSignature,
} from "./openai-realtime-sip";
import { demoRestaurantContext, type RestaurantVoiceContext } from "./restaurant-context";

const baseEnv = {
  OPENAI_API_KEY: "sk-test",
  PUBLIC_HTTP_BASE_URL: "https://voice.hostline.ai/",
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
} satisfies Partial<VoiceServiceEnv>;

describe("OpenAI Realtime SIP", () => {
  it("builds the pilot webhook and SIP configuration", () => {
    const config = buildOpenAIRealtimeLiveCallConfig(
      {
        ...baseEnv,
        OPENAI_PROJECT_ID: "proj_123",
      },
      "loc_123",
    );

    expect(config).toMatchObject({
      model: "gpt-realtime",
      projectIdConfigured: true,
      ready: true,
      sipUri: "sip:proj_123@sip.api.openai.com;transport=tls",
      voice: "marin",
      webhookSecretConfigured: false,
      webhookUrl: "https://voice.hostline.ai/openai/realtime/webhook?locationId=loc_123",
    });
  });

  it("configures semantic VAD, restaurant instructions, and realtime tools", () => {
    const payload = buildOpenAIRealtimeAcceptPayload({
      context: demoRestaurantContext,
      env: baseEnv,
    });

    expect(payload).toMatchObject({
      model: "gpt-realtime",
      output_modalities: ["audio"],
      tool_choice: "auto",
      type: "realtime",
    });
    expect(payload.audio.input.turn_detection).toMatchObject({
      create_response: true,
      eagerness: "medium",
      interrupt_response: true,
      type: "semantic_vad",
    });
    expect(payload.audio.output.voice).toBe("marin");
    expect(payload.instructions).toContain("Never restart the opening greeting");
    expect(payload.tools[0].name).toBe("lookup_restaurant_context");
  });

  it("preflights the realtime model and restaurant context before SIP testing", async () => {
    const fetchMock = async () => new Response(JSON.stringify({ id: "gpt-realtime" }), { status: 200 });
    const preflight = await buildOpenAIRealtimePreflight({
      env: {
        ...baseEnv,
        OPENAI_PROJECT_ID: "proj_123",
      },
      fetchImpl: fetchMock as typeof fetch,
      locationId: "loc_123",
      restaurantContextStore: {
        async getContext() {
          return demoRestaurantContext;
        },
      },
    });

    expect(preflight.ready).toBe(true);
    expect(preflight.config.webhookUrl).toBe("https://voice.hostline.ai/openai/realtime/webhook?locationId=loc_123");
    expect(preflight.checks.find((check) => check.id === "openai_realtime_model")).toMatchObject({ ready: true });
    expect(preflight.restaurantName).toBe("Olive & Ember");
  });

  it("uses the male OpenAI voice for male configured hosts", () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      voiceGender: "male",
    };

    const payload = buildOpenAIRealtimeAcceptPayload({
      context,
      env: baseEnv,
    });

    expect(payload.audio.output.voice).toBe("cedar");
  });

  it("keeps the no-mid-call-restart guidance in the reusable instructions", () => {
    const instructions = buildOpenAIRealtimeInstructions(demoRestaurantContext);

    expect(instructions).toContain("one continuous live phone call");
    expect(instructions).toContain("Say the opening greeting only once");
    expect(instructions).toContain("Handle interruptions gracefully");
  });

  it("extracts the call id from supported incoming webhook shapes", () => {
    expect(extractOpenAIRealtimeCallId({ data: { call_id: "call_123" } })).toBe("call_123");
    expect(extractOpenAIRealtimeCallId({ data: { call: { id: "call_456" } } })).toBe("call_456");
  });

  it("extracts completed realtime tool calls", () => {
    const toolCalls = extractOpenAIRealtimeToolCalls({
      response: {
        output: [
          {
            arguments: "{\"topic\":\"specials\"}",
            call_id: "call_tool_1",
            name: "lookup_restaurant_context",
            type: "function_call",
          },
        ],
      },
      type: "response.done",
    });

    expect(toolCalls).toEqual([
      {
        arguments: { topic: "specials" },
        callId: "call_tool_1",
        name: "lookup_restaurant_context",
      },
    ]);
  });

  it("returns menu and specials context for realtime lookup calls", () => {
    const result = lookupRestaurantContext(demoRestaurantContext, "specials");

    expect(JSON.stringify(result)).toContain("specials");
    expect(JSON.stringify(result)).toContain("Margherita pizza");
  });

  it("verifies OpenAI webhook signatures when a secret is configured", () => {
    const secretBytes = Buffer.from("secret");
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const rawBody = "{\"type\":\"realtime.call.incoming\"}";
    const timestamp = "1770000000";
    const webhookId = "wh_test";
    const signature = createHmac("sha256", secretBytes)
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest("base64");

    expect(
      verifyOpenAIWebhookSignature({
        headers: {
          "webhook-id": webhookId,
          "webhook-signature": `v1,${signature}`,
          "webhook-timestamp": timestamp,
        },
        nowSeconds: Number(timestamp),
        rawBody,
        secret,
      }),
    ).toBe(true);
  });
});
