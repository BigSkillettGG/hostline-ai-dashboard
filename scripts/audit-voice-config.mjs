import fs from "node:fs";

const demoAccounts = [
  {
    business: "Olive & Ember",
    email: "demo.restaurant@signalhost.ai",
    locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    vertical: "Restaurants",
  },
  {
    business: "Summit Air",
    email: "demo.hvac@signalhost.ai",
    locationId: "11111111-1111-4111-8111-111111111111",
    vertical: "HVAC",
  },
  {
    business: "Harbor Plumbing",
    email: "demo.plumbing@signalhost.ai",
    locationId: "22222222-2222-4222-8222-222222222222",
    vertical: "Plumbers",
  },
  {
    business: "RidgeLine Roofing",
    email: "demo.roofing@signalhost.ai",
    locationId: "33333333-3333-4333-8333-333333333333",
    vertical: "Roofers",
  },
  {
    business: "BrightWire Electric",
    email: "demo.electrical@signalhost.ai",
    locationId: "44444444-4444-4444-8444-444444444444",
    vertical: "Electricians",
  },
  {
    business: "Luna Studio",
    email: "demo.salon@signalhost.ai",
    locationId: "55555555-5555-4555-8555-555555555555",
    vertical: "Hair salons and barbershops",
  },
];

const env = { ...loadEnv(), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const adminEmail = env.SIGNALHOST_ADMIN_EMAIL ?? env.SIGNALHOST_SUPER_ADMIN_EMAIL;
const adminPassword = env.SIGNALHOST_ADMIN_PASSWORD ?? env.SIGNALHOST_SUPER_ADMIN_PASSWORD;
const voiceServiceUrl = (process.argv[2] ?? env.VOICE_SERVICE_URL ?? env.VITE_VOICE_SERVICE_URL ?? "https://hostline-voice.onrender.com").replace(/\/$/, "");

if (!supabaseUrl || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
  process.exit(1);
}

const adminToken = adminEmail && adminPassword ? await signIn(adminEmail, adminPassword) : undefined;
const locationIds = demoAccounts.map((account) => account.locationId).join(",");
const locations = adminToken
  ? await rest(`locations?id=in.(${locationIds})&select=id,name,cuisine,timezone,phone,ai_host_phone&order=name.asc`, adminToken)
  : [];
const phoneNumbers = adminToken
  ? await rest(
    `phone_numbers?location_id=in.(${locationIds})&select=location_id,phone_number,status,forwarding_status,provider_sid,voice_webhook_url,sms_webhook_url,provisioning_source&order=phone_number.asc`,
    adminToken,
  )
  : [];
const agentConfigs = adminToken
  ? await rest(`agent_configs?location_id=in.(${locationIds})&select=location_id,host_name,voice_gender,greeting_template,call_mode&order=location_id.asc`, adminToken)
  : [];

const locationMap = rowsByKey(locations, "id");
const configMap = rowsByKey(agentConfigs, "location_id");
const phoneRowsByLocation = rowsGroupedByKey(phoneNumbers, "location_id");
const voiceConfigs = [];

for (const account of demoAccounts) {
  const voiceConfig = adminToken
    ? await fetchVoiceConfig(account.locationId, adminToken)
    : { skipped: true, reason: "Set SIGNALHOST_ADMIN_EMAIL and SIGNALHOST_ADMIN_PASSWORD to check the deployed voice service." };
  const phones = phoneRowsByLocation.get(account.locationId) ?? [];
  voiceConfigs.push({
    ...account,
    agentConfig: configMap.get(account.locationId) ?? null,
    location: locationMap.get(account.locationId) ?? null,
    phoneNumbers: phones.map((row) => ({
      phoneNumber: row.phone_number,
      providerSidPresent: Boolean(row.provider_sid),
      provisioningSource: row.provisioning_source ?? null,
      route: classifyPhoneRoute(row),
      smsWebhookConfigured: Boolean(row.sms_webhook_url),
      status: row.status ?? null,
      voiceWebhook: row.voice_webhook_url ?? null,
    })),
    routeWarnings: buildRouteWarnings(phones),
    voiceConfig: summarizeVoiceConfig(voiceConfig),
  });
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: adminToken
    ? "Read-only audit complete. No records were changed."
    : "Set SIGNALHOST_ADMIN_EMAIL and SIGNALHOST_ADMIN_PASSWORD to include live Supabase and voice-service checks.",
  voiceServiceUrl,
  voiceConfigs,
}, null, 2));

function loadEnv() {
  const paths = [".env.local", ".env"];
  const result = {};
  for (const path of paths) {
    if (!fs.existsSync(path)) continue;
    const text = fs.readFileSync(path, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

async function signIn(email, password) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password }),
    headers: {
      apikey: anonKey,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    console.warn(`Could not sign in ${email}; live audit checks will be skipped.`);
    return undefined;
  }
  return (await response.json()).access_token;
}

async function rest(path, token) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    return { error: `${response.status} ${text}` };
  }
  return text ? JSON.parse(text) : [];
}

async function fetchVoiceConfig(locationId, token) {
  try {
    const response = await fetch(`${voiceServiceUrl}/openai/realtime/live-call-config?locationId=${encodeURIComponent(locationId)}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const text = await response.text();
    return {
      body: text ? JSON.parse(text) : {},
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function rowsByKey(rows, key) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (row?.[key]) map.set(row[key], row);
  }
  return map;
}

function rowsGroupedByKey(rows, key) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const value = row?.[key];
    if (!value) continue;
    const bucket = map.get(value) ?? [];
    bucket.push(row);
    map.set(value, bucket);
  }
  return map;
}

function summarizeVoiceConfig(result) {
  if (result?.skipped) return result;
  if (result?.error) return result;
  const config = result?.body ?? {};
  return {
    acceptProvider: config.acceptProvider,
    callRecordingConfigured: config.callRecordingConfigured,
    greetingDelayMs: config.greetingDelayMs,
    manualResponseGating: config.manualResponseGating,
    model: config.model,
    noiseReduction: config.noiseReduction,
    postResponseListenGuardMs: config.postResponseListenGuardMs,
    ready: config.ready,
    speed: config.speed,
    status: result?.status,
    turnDetection: config.turnDetection,
    voice: config.voice,
  };
}

function classifyPhoneRoute(row) {
  const webhook = String(row.voice_webhook_url ?? "");
  if (webhook.includes("/vapi/webhook")) return "vapi_pilot";
  if (webhook.includes("/twilio/livekit-voice")) return "livekit_agent";
  if (webhook.includes("/openai/realtime") || webhook.includes("/twilio/openai-realtime")) return "openai_realtime_sip_webhook";
  if (webhook.includes("/twilio/voice")) return "twilio_conversation_relay";
  if (row.provider_sid) return "twilio_sip_trunk_or_external_route";
  return "unknown";
}

function buildRouteWarnings(phones) {
  if (!Array.isArray(phones) || !phones.length) return ["No phone number rows found for this demo location."];
  const warnings = [];
  for (const row of phones) {
    const route = classifyPhoneRoute(row);
    if (route === "livekit_agent") warnings.push(`${row.phone_number} is still routed to the LiveKit experiment.`);
    if (route === "twilio_conversation_relay") warnings.push(`${row.phone_number} appears to be routed to legacy ConversationRelay.`);
    if (route === "unknown") warnings.push(`${row.phone_number} has no recognizable voice route.`);
  }
  return warnings;
}
