const baseUrl = process.argv[2]?.replace(/\/$/, "");
const locationId = process.argv[3];
const internalApiKey = process.env.HOSTLINE_INTERNAL_API_KEY;

if (!baseUrl) {
  console.error("Usage: npm run check:voice -- https://voice.example.com [location-id]");
  process.exit(1);
}

const health = await readJson(`${baseUrl}/health`);
const ready = await readJson(`${baseUrl}/ready`, { allowFailure: true });

console.log(`Voice service: ${health.service ?? "unknown"}`);
console.log(`Health: ${health.ok ? "ok" : "failed"}`);
console.log(`Production ready: ${ready.productionReady ? "yes" : "no"}`);

for (const check of ready.readinessChecks ?? health.readinessChecks ?? []) {
  const marker = check.ready ? "OK" : check.required ? "MISSING" : "OPTIONAL";
  console.log(`${marker.padEnd(8)} ${check.label}`);
}

if (internalApiKey) {
  const query = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  const liveCallConfig = await readJson(`${baseUrl}/twilio/live-call-config${query}`, {
    allowFailure: true,
    headers: { "x-hostline-api-key": internalApiKey },
  });
  const openAIRealtimeConfig = await readJson(`${baseUrl}/openai/realtime/live-call-config${query}`, {
    allowFailure: true,
    headers: { "x-hostline-api-key": internalApiKey },
  });
  const twiml = await readText(`${baseUrl}/twilio/twiml-preview${query}`, {
    allowFailure: true,
    headers: { "x-hostline-api-key": internalApiKey },
  });

  console.log("");
  console.log(`Voice webhook: ${liveCallConfig.voiceWebhookUrl ?? "unavailable"}`);
  console.log(`ConversationRelay: ${liveCallConfig.conversationRelayUrl ?? "unavailable"}`);
  console.log(`OpenAI Realtime webhook: ${openAIRealtimeConfig.webhookUrl ?? "unavailable"}`);
  console.log(`OpenAI Realtime SIP URI: ${openAIRealtimeConfig.sipUri ?? "use the OpenAI dashboard/project SIP URI"}`);
  console.log(`TwiML preview: ${twiml.includes("<ConversationRelay") ? "ok" : "missing ConversationRelay"}`);
} else {
  console.log("");
  console.log("Skipping live-call URL preview because HOSTLINE_INTERNAL_API_KEY is not set.");
}

if (!health.ok || !ready.productionReady) {
  process.exit(2);
}

async function readJson(url, options = {}) {
  const response = await fetch(url, { headers: options.headers });
  if (!response.ok && !options.allowFailure) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url} did not return JSON: ${text.slice(0, 120)}`);
  }
}

async function readText(url, options = {}) {
  const response = await fetch(url, { headers: options.headers });
  if (!response.ok && !options.allowFailure) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}
