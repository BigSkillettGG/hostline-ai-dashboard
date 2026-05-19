import { describe, expect, it } from "vitest";
import type { VoiceServiceEnv } from "./env";
import {
  buildOpenAIAgentsRealtimeAcceptPayload,
  buildOpenAIAgentsRealtimePreflight,
  findUnsupportedSipTurnDetectionFields,
  toSipSdkTurnDetection,
} from "./openai-agents-realtime-spike";
import { buildOpenAIRealtimeAcceptPayload } from "./openai-realtime-sip";
import { demoRestaurantContext, type RestaurantVoiceContext } from "./restaurant-context";

const baseEnv = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 12000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_MANUAL_RESPONSE_GATING: true,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 150,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 900,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.88,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
} as VoiceServiceEnv;

describe("OpenAI Agents Realtime SIP spike", () => {
  it("builds an SDK SIP accept payload without replacing the live custom payload", async () => {
    const customPayload = buildOpenAIRealtimeAcceptPayload({
      context: demoRestaurantContext,
      env: baseEnv,
    });
    const sdkPayload = await buildOpenAIAgentsRealtimeAcceptPayload({
      context: demoRestaurantContext,
      env: baseEnv,
    });

    expect(sdkPayload).toMatchObject({
      model: "gpt-realtime-2",
      output_modalities: ["audio"],
      tool_choice: "auto",
      type: "realtime",
    });
    expect(sdkPayload.instructions).toContain("Thank you for calling Olive and Ember. How can I help you?");
    expect(sdkPayload.tools.map((sdkTool: { name: string }) => sdkTool.name)).toEqual(
      customPayload.tools.map((customTool) => customTool.name),
    );
    expect(sdkPayload.audio.input.noise_reduction).toEqual({ type: "far_field" });
    expect(sdkPayload.audio.output).toMatchObject({ speed: 1.02, voice: "marin" });
    expect(sdkPayload.audio.input.turn_detection).toMatchObject({
      create_response: false,
      interrupt_response: false,
      type: "server_vad",
    });
    expect(sdkPayload.audio.input.turn_detection).not.toHaveProperty("threshold");
    expect(sdkPayload.audio.input.turn_detection).not.toHaveProperty("prefix_padding_ms");
    expect(sdkPayload.audio.input.turn_detection).not.toHaveProperty("silence_duration_ms");
  });

  it("keeps service-business tools aligned with the custom realtime payload", async () => {
    const context: RestaurantVoiceContext = {
      ...demoRestaurantContext,
      businessType: "plumbing",
      menuHighlights: ["Active leaks", "Water heaters", "Drain cleaning"],
      restaurantName: "Harbor Plumbing",
    };
    const sdkPayload = await buildOpenAIAgentsRealtimeAcceptPayload({ context, env: baseEnv });

    expect(sdkPayload.instructions).toContain("Business profile: plumbing company");
    expect(sdkPayload.tools.map((sdkTool: { name: string }) => sdkTool.name)).toContain("lookup_business_context");
    expect(sdkPayload.tools.map((sdkTool: { name: string }) => sdkTool.name)).toContain("create_customer_request");
    expect(sdkPayload.tools.map((sdkTool: { name: string }) => sdkTool.name)).not.toContain("create_reservation_request");
  });

  it("summarizes SDK and custom payloads in a diagnostic preflight", async () => {
    const preflight = await buildOpenAIAgentsRealtimePreflight({
      env: baseEnv,
      locationId: "loc_123",
      restaurantContextStore: {
        async getContext() {
          return demoRestaurantContext;
        },
      },
    });

    expect(preflight.ready).toBe(true);
    expect(preflight.locationId).toBe("loc_123");
    expect(preflight.restaurantName).toBe("Olive & Ember");
    expect(preflight.omittedTurnDetectionFields).toEqual(["threshold", "prefix_padding_ms", "silence_duration_ms"]);
    expect(preflight.comparison.customAccept.toolNames).toContain("lookup_restaurant_context");
    expect(preflight.comparison.customAccept.maxOutputTokens).toBe(280);
    expect(preflight.comparison.sdkAccept.toolNames).toContain("lookup_restaurant_context");
    expect(preflight.comparison.sdkAccept.maxOutputTokens).toBeUndefined();
    expect(preflight.comparison.sdkAccept.turnDetection).not.toHaveProperty("threshold");
  });

  it("normalizes current VAD settings into the SDK SIP-safe shape", () => {
    const currentPayload = buildOpenAIRealtimeAcceptPayload({
      context: demoRestaurantContext,
      env: baseEnv,
    });

    expect(findUnsupportedSipTurnDetectionFields(currentPayload.audio.input.turn_detection)).toEqual([
      "threshold",
      "prefix_padding_ms",
      "silence_duration_ms",
    ]);
    expect(toSipSdkTurnDetection(currentPayload.audio.input.turn_detection)).toEqual({
      createResponse: false,
      interruptResponse: false,
      type: "server_vad",
    });
  });
});
