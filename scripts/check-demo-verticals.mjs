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

const demoPassword = "SignalHostDemo!2026";
const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const adminEmail = process.env.SIGNALHOST_ADMIN_EMAIL;
const adminPassword = process.env.SIGNALHOST_ADMIN_PASSWORD;

if (!supabaseUrl || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
  process.exit(1);
}

const demoAuth = [];
for (const account of demoAccounts) {
  demoAuth.push({
    business: account.business,
    email: account.email,
    locationId: account.locationId,
    login: (await signIn(account.email, demoPassword)) ? "ok" : "missing",
    vertical: account.vertical,
  });
}

let liveRows = [];
let phoneRows = [];
let latestCalls = [];
if (adminEmail && adminPassword) {
  const adminToken = await signIn(adminEmail, adminPassword);
  if (!adminToken) {
    console.warn("Could not sign in with SIGNALHOST_ADMIN_EMAIL/SIGNALHOST_ADMIN_PASSWORD; skipping live row checks.");
  } else {
    const locationIds = demoAccounts.map((account) => account.locationId).join(",");
    liveRows = await rest(
      `locations?id=in.(${locationIds})&select=id,name,cuisine,timezone,phone,ai_host_phone&order=name.asc`,
      adminToken,
    );
    phoneRows = await rest(
      `phone_numbers?location_id=in.(${locationIds})&select=location_id,phone_number,status,forwarding_status,provider_sid,voice_webhook_url,sms_webhook_url&order=phone_number.asc`,
      adminToken,
    );
    latestCalls = await rest(
      `calls?location_id=in.(${locationIds})&select=id,location_id,caller_phone,started_at,intent,outcome,recording_url&order=started_at.desc&limit=20`,
      adminToken,
    );
    if (Array.isArray(latestCalls)) {
      latestCalls = latestCalls.map((call) => ({
        ...call,
        recording_url: redactSignedUrl(call.recording_url),
      }));
    }
  }
}

console.log(JSON.stringify({
  demoPassword,
  liveRows,
  phoneRows,
  latestCalls,
  loginChecks: demoAuth,
  note: adminEmail
    ? "Admin live row checks included."
    : "Set SIGNALHOST_ADMIN_EMAIL and SIGNALHOST_ADMIN_PASSWORD to include live Supabase row checks.",
}, null, 2));

function loadEnv() {
  const paths = [".env.local", ".env"];
  const result = {};
  for (const path of paths) {
    if (!fs.existsSync(path)) continue;
    const text = fs.readFileSync(path, "utf8");
    for (const match of text.matchAll(/^([^#=\n]+)=("?)(.*?)\2$/gm)) {
      result[match[1].trim()] = match[3].trim();
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
  if (!response.ok) return undefined;
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

function redactSignedUrl(value) {
  if (typeof value !== "string" || !value) return value;
  try {
    const url = new URL(value);
    if (url.searchParams.has("token")) {
      url.searchParams.set("token", "redacted");
    }
    return url.toString();
  } catch {
    return value.replace(/([?&]token=)[^&]+/i, "$1redacted");
  }
}
