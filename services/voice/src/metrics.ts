export interface RuntimeMetricSnapshot {
  activeOpenAIRealtimeSockets?: number;
  activeRelayCompletions?: number;
  activeRelaySockets?: number;
}

interface HttpMetricInput {
  durationMs: number;
  method: string;
  path: string;
  statusCode: number;
}

interface ToolMetricInput {
  latencyMs: number;
  name: string;
  ok: boolean;
}

const startedAt = Date.now();
const httpMetrics = new Map<string, { count: number; durationMs: number }>();
const toolMetrics = new Map<string, { count: number; latencyMs: number }>();

export function recordHttpRequestMetric(input: HttpMetricInput) {
  const key = labelsKey({
    method: normalizeLabel(input.method),
    path: normalizePath(input.path),
    status: String(input.statusCode),
  });
  const metric = httpMetrics.get(key) ?? { count: 0, durationMs: 0 };
  metric.count += 1;
  metric.durationMs += Math.max(0, input.durationMs);
  httpMetrics.set(key, metric);
}

export function recordToolCallMetric(input: ToolMetricInput) {
  const key = labelsKey({
    name: normalizeLabel(input.name),
    ok: input.ok ? "true" : "false",
  });
  const metric = toolMetrics.get(key) ?? { count: 0, latencyMs: 0 };
  metric.count += 1;
  metric.latencyMs += Math.max(0, input.latencyMs);
  toolMetrics.set(key, metric);
}

export function renderPrometheusMetrics(runtime: RuntimeMetricSnapshot = {}) {
  const lines = [
    "# HELP signalhost_voice_uptime_seconds Voice service uptime in seconds.",
    "# TYPE signalhost_voice_uptime_seconds gauge",
    `signalhost_voice_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
    "# HELP signalhost_voice_active_relay_sockets Active Twilio ConversationRelay websocket connections.",
    "# TYPE signalhost_voice_active_relay_sockets gauge",
    `signalhost_voice_active_relay_sockets ${runtime.activeRelaySockets ?? 0}`,
    "# HELP signalhost_voice_active_relay_completions ConversationRelay completions waiting for reconnect grace.",
    "# TYPE signalhost_voice_active_relay_completions gauge",
    `signalhost_voice_active_relay_completions ${runtime.activeRelayCompletions ?? 0}`,
    "# HELP signalhost_voice_active_openai_realtime_sockets Active OpenAI Realtime sideband websocket connections.",
    "# TYPE signalhost_voice_active_openai_realtime_sockets gauge",
    `signalhost_voice_active_openai_realtime_sockets ${runtime.activeOpenAIRealtimeSockets ?? 0}`,
    "# HELP signalhost_voice_http_requests_total HTTP requests handled by the voice service.",
    "# TYPE signalhost_voice_http_requests_total counter",
  ];

  for (const [labels, metric] of httpMetrics) {
    lines.push(`signalhost_voice_http_requests_total{${labels}} ${metric.count}`);
  }

  lines.push(
    "# HELP signalhost_voice_http_request_duration_ms_sum Total HTTP request duration in milliseconds.",
    "# TYPE signalhost_voice_http_request_duration_ms_sum counter",
  );
  for (const [labels, metric] of httpMetrics) {
    lines.push(`signalhost_voice_http_request_duration_ms_sum{${labels}} ${Math.round(metric.durationMs)}`);
  }

  lines.push(
    "# HELP signalhost_voice_tool_calls_total Realtime tool calls grouped by tool name and success.",
    "# TYPE signalhost_voice_tool_calls_total counter",
  );
  for (const [labels, metric] of toolMetrics) {
    lines.push(`signalhost_voice_tool_calls_total{${labels}} ${metric.count}`);
  }

  lines.push(
    "# HELP signalhost_voice_tool_call_latency_ms_sum Total realtime tool-call latency in milliseconds.",
    "# TYPE signalhost_voice_tool_call_latency_ms_sum counter",
  );
  for (const [labels, metric] of toolMetrics) {
    lines.push(`signalhost_voice_tool_call_latency_ms_sum{${labels}} ${Math.round(metric.latencyMs)}`);
  }

  return `${lines.join("\n")}\n`;
}

export function resetMetricsForTests() {
  httpMetrics.clear();
  toolMetrics.clear();
}

function normalizePath(path: string) {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/\/+$/, "") || "/";
}

function normalizeLabel(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:/-]/g, "_").slice(0, 120) || "unknown";
}

function labelsKey(labels: Record<string, string>) {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
}
