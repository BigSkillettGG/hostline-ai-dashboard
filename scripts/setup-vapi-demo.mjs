import { randomBytes } from "node:crypto";
import fs from "node:fs";

const demoTargets = [
  {
    aliases: ["restaurant", "olive", "olive-ember"],
    business: "Olive & Ember",
    locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    liveNumber: "+1 781 423 3898",
    vertical: "Restaurants",
  },
  {
    aliases: ["hvac", "summit", "summit-air"],
    business: "Summit Air",
    locationId: "11111111-1111-4111-8111-111111111111",
    liveNumber: "+1 617 545 0460",
    vertical: "HVAC",
  },
  {
    aliases: ["plumbing", "plumber", "harbor", "harbor-plumbing"],
    business: "Harbor Plumbing",
    locationId: "22222222-2222-4222-8222-222222222222",
    liveNumber: "+1 781 694 6083",
    vertical: "Plumbers",
  },
  {
    aliases: ["roofing", "roofer", "ridgeline", "ridgeline-roofing"],
    business: "RidgeLine Roofing",
    locationId: "33333333-3333-4333-8333-333333333333",
    liveNumber: "+1 508 290 3711",
    vertical: "Roofers",
  },
  {
    aliases: ["electrical", "electrician", "brightwire", "brightwire-electric"],
    business: "BrightWire Electric",
    locationId: "44444444-4444-4444-8444-444444444444",
    liveNumber: "+1 978 933 7955",
    vertical: "Electricians",
  },
  {
    aliases: ["salon", "hair", "luna", "luna-studio"],
    business: "Luna Studio",
    locationId: "55555555-5555-4555-8555-555555555555",
    liveNumber: "+1 339 330 4271",
    vertical: "Hair salons and barbershops",
  },
];

const args = process.argv.slice(2);
const businessArg = findArgValue("--business") ?? "harbor";
const sync = args.includes("--sync");
const env = { ...loadEnv(), ...process.env };
const voiceServiceUrl = (findArgValue("--voice-service-url") ?? env.VOICE_SERVICE_URL ?? env.VITE_VOICE_SERVICE_URL ?? "https://hostline-voice.onrender.com").replace(/\/$/, "");
const target = findTarget(businessArg);
const webhookSecret = env.VAPI_WEBHOOK_SECRET || randomBytes(24).toString("hex");
const webhookUrl = `${voiceServiceUrl}/vapi/webhook?locationId=${encodeURIComponent(target.locationId)}`;
const assistantName = `SignalHost ${target.business} Vapi Pilot`;
const health = await fetchJson(`${voiceServiceUrl}/health`).catch((error) => ({ error: error.message }));
const syncResult = sync ? await syncAssistant(target.locationId).catch((error) => ({ error: error.message })) : undefined;

console.log(JSON.stringify({
  assistantName,
  business: target.business,
  currentSignalHostNumber: target.liveNumber,
  health: summarizeHealth(health),
  locationId: target.locationId,
  note: "Use a new Vapi test number first. Do not move the current SignalHost number until this pilot wins the A/B test.",
  renderEnvironmentVariables: {
    VAPI_API_KEY: "paste your Vapi private API key",
    VAPI_MAX_CALL_SECONDS: "600",
    VAPI_OPENAI_MODEL: env.VAPI_OPENAI_MODEL || "gpt-realtime-2025-08-28",
    VAPI_OPENAI_VOICE_ID: env.VAPI_OPENAI_VOICE_ID || "marin",
    VAPI_PILOT_ENABLED: "true",
    VAPI_PILOT_LOCATION_IDS: target.locationId,
    VAPI_WEBHOOK_SECRET: webhookSecret,
  },
  syncResult,
  vapiDashboardSetup: {
    firstMessage: `Thank you for calling ${target.business}. How can I help you?`,
    phoneNumber: "Create a new free US Vapi number, or import a spare Twilio number. Do not import the current SignalHost number for this first test.",
    serverHeader: `Authorization: Bearer ${webhookSecret}`,
    serverUrl: webhookUrl,
  },
  webhookUrl,
}, null, 2));

function findArgValue(name) {
  const arg = args.find((value) => value.startsWith(`${name}=`));
  return arg?.slice(name.length + 1);
}

function findTarget(value) {
  const normalized = value.toLowerCase().trim();
  const target = demoTargets.find((item) => item.aliases.includes(normalized) || item.business.toLowerCase() === normalized);
  if (!target) {
    throw new Error(`Unknown demo business "${value}". Use one of: ${demoTargets.map((item) => item.aliases[0]).join(", ")}.`);
  }
  return target;
}

function loadEnv() {
  const result = {};
  for (const path of [".env.local", ".env"]) {
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

async function syncAssistant(locationId) {
  const token = await getAdminToken();
  if (!token) {
    throw new Error("Set SIGNALHOST_ADMIN_EMAIL and SIGNALHOST_ADMIN_PASSWORD to use --sync.");
  }

  const response = await fetch(`${voiceServiceUrl}/vapi/sync-assistant`, {
    body: JSON.stringify({ locationId }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${body}`);
  return body ? JSON.parse(body) : {};
}

async function getAdminToken() {
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  const email = env.SIGNALHOST_ADMIN_EMAIL;
  const password = env.SIGNALHOST_ADMIN_PASSWORD;
  if (!supabaseUrl || !anonKey || !email || !password) return undefined;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password }),
    headers: {
      apikey: anonKey,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) return undefined;
  return (await response.json()).access_token;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

function summarizeHealth(health) {
  if (health.error) return health;
  return {
    openAIRealtimeSipConfigured: health.openAIRealtimeSipConfigured,
    productionReady: health.productionReady,
    vapiPilotAssistantIdConfigured: health.vapiPilotAssistantIdConfigured,
    vapiPilotConfigured: health.vapiPilotConfigured,
    vapiPilotPhoneNumberIdConfigured: health.vapiPilotPhoneNumberIdConfigured,
  };
}
