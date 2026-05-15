import fs from "node:fs";

const demoTargets = [
  {
    areaCode: "415",
    business: "Olive & Ember",
    locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    mainPhone: "+14155550148",
    vertical: "restaurant",
  },
  {
    areaCode: "617",
    business: "Summit Air",
    locationId: "11111111-1111-4111-8111-111111111111",
    mainPhone: "+16175550100",
    vertical: "hvac",
  },
  {
    areaCode: "781",
    business: "Harbor Plumbing",
    locationId: "22222222-2222-4222-8222-222222222222",
    mainPhone: "+17815550108",
    vertical: "plumbing",
  },
  {
    areaCode: "508",
    business: "RidgeLine Roofing",
    locationId: "33333333-3333-4333-8333-333333333333",
    mainPhone: "+15085550102",
    vertical: "roofing",
  },
  {
    areaCode: "978",
    business: "BrightWire Electric",
    locationId: "44444444-4444-4444-8444-444444444444",
    mainPhone: "+19785550120",
    vertical: "electrical",
  },
  {
    areaCode: "339",
    business: "Luna Studio",
    locationId: "55555555-5555-4555-8555-555555555555",
    mainPhone: "+13395550122",
    vertical: "salon",
  },
];

const args = new Set(process.argv.slice(2));
const commit = args.has("--commit");
const includeArg = process.argv.find((arg) => arg.startsWith("--include="));
const include = new Set((includeArg?.split("=")[1] ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean));
const voiceServiceUrl = (process.env.VOICE_SERVICE_URL || "https://hostline-voice.onrender.com").replace(/\/$/, "");
const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const adminEmail = process.env.SIGNALHOST_ADMIN_EMAIL;
const adminPassword = process.env.SIGNALHOST_ADMIN_PASSWORD;

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
}
if (!adminEmail || !adminPassword) {
  throw new Error("Set SIGNALHOST_ADMIN_EMAIL and SIGNALHOST_ADMIN_PASSWORD before provisioning demo numbers.");
}

const token = await signIn(adminEmail, adminPassword);
if (!token) {
  throw new Error("Could not sign in with the platform admin credentials.");
}

const results = [];
for (const target of demoTargets) {
  if (include.size && !include.has(target.vertical) && !include.has(target.business.toLowerCase())) continue;

  const liveLocation = await rest(
    `locations?id=eq.${encodeURIComponent(target.locationId)}&select=id,name,ai_host_phone&limit=1`,
    token,
  );
  if (!liveLocation?.[0]) {
    results.push({
      business: target.business,
      locationId: target.locationId,
      status: "missing_location_seed",
    });
    continue;
  }

  const existingRows = await rest(
    [
      `phone_numbers?location_id=eq.${encodeURIComponent(target.locationId)}`,
      "released_at=is.null",
      "provider_sid=not.is.null",
      "status=in.(provisioned,trialing,in-use,active)",
      "select=phone_number,provider_sid,status,voice_webhook_url",
      "order=created_at.desc",
      "limit=1",
    ].join("&"),
    token,
  ).catch(async () => rest(
    [
      `phone_numbers?location_id=eq.${encodeURIComponent(target.locationId)}`,
      "provider_sid=not.is.null",
      "status=in.(provisioned,trialing,in-use,active)",
      "select=phone_number,provider_sid,status,voice_webhook_url",
      "order=created_at.desc",
      "limit=1",
    ].join("&"),
    token,
  ));
  if (existingRows?.[0]?.phone_number) {
    results.push({
      business: target.business,
      locationId: target.locationId,
      phoneNumber: existingRows[0].phone_number,
      providerSid: existingRows[0].provider_sid,
      status: "already_has_number",
      voiceWebhookUrl: existingRows[0].voice_webhook_url,
    });
    continue;
  }

  const available = await voiceRequest(
    `/telephony/available-numbers?areaCode=${encodeURIComponent(target.areaCode)}&limit=3`,
    token,
  );
  const selected = available.numbers?.[0];
  if (!selected?.phoneNumber) {
    results.push({
      areaCode: target.areaCode,
      business: target.business,
      locationId: target.locationId,
      status: "no_available_number",
    });
    continue;
  }

  if (!commit) {
    results.push({
      areaCode: target.areaCode,
      business: target.business,
      candidate: selected.phoneNumber,
      locationId: target.locationId,
      status: "preview_only",
    });
    continue;
  }

  const provisioned = await voiceRequest("/telephony/provision-number", token, {
    areaCode: target.areaCode,
    forwardingMode: "forward_unanswered",
    locationId: target.locationId,
    phoneNumber: selected.phoneNumber,
    restaurantMainLine: target.mainPhone,
    trialDays: 7,
    trialGraceDays: 14,
  });
  results.push({
    business: target.business,
    locationId: target.locationId,
    phoneNumber: provisioned.phoneNumber?.phoneNumber,
    providerSid: provisioned.phoneNumber?.providerSid,
    routingMode: provisioned.phoneNumber?.routingMode,
    status: "provisioned",
    voiceWebhookUrl: provisioned.phoneNumber?.voiceWebhookUrl,
  });
}

console.log(JSON.stringify({
  commit,
  results,
  voiceServiceUrl,
}, null, 2));

function loadEnv() {
  const result = {};
  for (const path of [".env.local", ".env"]) {
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
  if (!response.ok) throw new Error(`Supabase ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : [];
}

async function voiceRequest(path, token, body) {
  const response = await fetch(`${voiceServiceUrl}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    method: body ? "POST" : "GET",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Voice service ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}
