import { beforeEach, describe, expect, it } from "vitest";
import {
  recordHttpRequestMetric,
  recordToolCallMetric,
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "./metrics";

describe("voice service metrics", () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it("renders low-cardinality prometheus counters and runtime gauges", () => {
    recordHttpRequestMetric({
      durationMs: 42,
      method: "GET",
      path: "/calls/78d8053b-631d-4811-939f-61f0efe1d82a",
      statusCode: 200,
    });
    recordToolCallMetric({ latencyMs: 125, name: "create_customer_request", ok: true });

    const metrics = renderPrometheusMetrics({
      activeOpenAIRealtimeSockets: 2,
      activeRelayCompletions: 1,
      activeRelaySockets: 3,
    });

    expect(metrics).toContain("signalhost_voice_active_openai_realtime_sockets 2");
    expect(metrics).toContain('signalhost_voice_http_requests_total{method="GET",path="/calls/:uuid",status="200"} 1');
    expect(metrics).toContain('signalhost_voice_http_request_duration_ms_sum{method="GET",path="/calls/:uuid",status="200"} 42');
    expect(metrics).toContain('signalhost_voice_tool_calls_total{name="create_customer_request",ok="true"} 1');
    expect(metrics).toContain('signalhost_voice_tool_call_latency_ms_sum{name="create_customer_request",ok="true"} 125');
  });
});
