import { readFileSync } from "node:fs";

const HARBOR_LOCATION_ID = "22222222-2222-4222-8222-222222222222";
const HARBOR_MAIN_LINE = "+17815550108";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const normalized = arg.replace(/^--/, "");
    const [key, ...rest] = normalized.split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const env = loadEnvFile();
const baseUrl = String(args.get("base-url") || process.env.VOICE_SERVICE_BASE_URL || "https://hostline-voice.onrender.com").replace(/\/$/, "");
const areaCode = String(args.get("area-code") || process.env.HARBOR_AB_AREA_CODE || "781");
const shouldProvision = args.has("provision");

const email = process.env.SIGNALHOST_ADMIN_EMAIL || "tim@hostline.ai";
const password = process.env.SIGNALHOST_ADMIN_PASSWORD;
if (!password) {
  throw new Error("Set SIGNALHOST_ADMIN_PASSWORD before running this script.");
}

const token = await getSupabaseAccessToken({
  email,
  password,
  publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: env.VITE_SUPABASE_URL,
});

if (!shouldProvision) {
  const numbers = await readJson(`${baseUrl}/telephony/available-numbers?areaCode=${encodeURIComponent(areaCode)}&limit=5`, {
    headers: { authorization: `Bearer ${token}` },
  });
  console.log(JSON.stringify({
    dryRun: true,
    nextStep: "Run again with --provision to buy the first available number.",
    numbers: numbers.numbers ?? [],
  }, null, 2));
  process.exit(0);
}

const result = await readJson(`${baseUrl}/telephony/provision-number`, {
  body: JSON.stringify({
    allowAdditionalNumber: true,
    areaCode,
    forwardingMode: "forward_unanswered",
    locationId: HARBOR_LOCATION_ID,
    makePrimary: false,
    restaurantMainLine: HARBOR_MAIN_LINE,
  }),
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  method: "POST",
});

console.log(JSON.stringify({
  directOpenAITestNumber: result.phoneNumber?.phoneNumber,
  harborLocationId: HARBOR_LOCATION_ID,
  nextStep: "Call this number for the direct OpenAI Realtime side of the A/B test.",
  result,
}, null, 2));

function loadEnvFile() {
  const text = readFileSync(".env", "utf8");
  const parsed = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    parsed[trimmed.slice(0, index)] = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
  }
  return parsed;
}

async function getSupabaseAccessToken({ email, password, publishableKey, supabaseUrl }) {
  if (!publishableKey || !supabaseUrl) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be present in .env.");
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password }),
    headers: {
      apikey: publishableKey,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Supabase login failed: ${response.status} ${await response.text()}`);
  }
  const body = await response.json();
  return body.access_token;
}

async function readJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}
