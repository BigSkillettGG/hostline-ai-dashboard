import fs from "node:fs";

const demoTargets = [
  {
    aliases: ["restaurant", "olive", "olive-ember"],
    areaCodes: ["781", "617", "857"],
    business: "Olive & Ember",
    locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    vertical: "restaurant",
  },
  {
    aliases: ["hvac", "summit", "summit-air"],
    areaCodes: ["617", "781", "857"],
    business: "Summit Air",
    locationId: "11111111-1111-4111-8111-111111111111",
    vertical: "hvac",
  },
  {
    aliases: ["plumbing", "plumber", "harbor", "harbor-plumbing"],
    areaCodes: ["781", "339", "617"],
    business: "Harbor Plumbing",
    locationId: "22222222-2222-4222-8222-222222222222",
    vertical: "plumbing",
  },
  {
    aliases: ["roofing", "roofer", "ridgeline", "ridgeline-roofing"],
    areaCodes: ["508", "774", "781"],
    business: "RidgeLine Roofing",
    locationId: "33333333-3333-4333-8333-333333333333",
    vertical: "roofing",
  },
  {
    aliases: ["electrical", "electrician", "brightwire", "brightwire-electric"],
    areaCodes: ["978", "351", "781"],
    business: "BrightWire Electric",
    locationId: "44444444-4444-4444-8444-444444444444",
    vertical: "electrical",
  },
  {
    aliases: ["salon", "hair", "luna", "luna-studio"],
    areaCodes: ["339", "781", "617"],
    business: "Luna Studio",
    locationId: "55555555-5555-4555-8555-555555555555",
    vertical: "salon",
  },
];

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const createPhoneNumbers = args.includes("--create-phone-numbers");
const forceNewPhoneNumber = args.includes("--force-new-phone-number");
const makePrimary = args.includes("--make-primary");
const include = parseInclude(findArgValue("--include") ?? findArgValue("--business"));
const areaCodeOverrides = parseMapping(findArgValue("--area-codes"));
const assistantIds = parseMapping(findArgValue("--assistant-ids"));
const syncAssistants = args.includes("--sync-assistants") || assistantIds.size > 0;
const existingPhoneNumberIds = parseMapping(findArgValue("--phone-number-ids"));
const env = { ...loadEnv(), ...process.env };
const voiceServiceUrl = (findArgValue("--voice-service-url") ?? env.VOICE_SERVICE_URL ?? "https://hostline-voice.onrender.com").replace(/\/$/, "");
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const adminEmail = env.SIGNALHOST_ADMIN_EMAIL;
const adminPassword = env.SIGNALHOST_ADMIN_PASSWORD;

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
}
if (!adminEmail || !adminPassword) {
  throw new Error("Set SIGNALHOST_ADMIN_EMAIL and SIGNALHOST_ADMIN_PASSWORD before syncing Vapi demos.");
}
if (commit && !syncAssistants && !createPhoneNumbers && !existingPhoneNumberIds.size) {
  console.warn("[provision-vapi-demos] Nothing to change. Add --create-phone-numbers, --phone-number-ids=vertical:id, or --sync-assistants.");
}

const token = await signIn(adminEmail, adminPassword);
if (!token) {
  throw new Error("Could not sign in with the SignalHost platform admin credentials.");
}

const results = [];
for (const target of demoTargets) {
  if (include.size && !targetMatchesInclude(target, include)) continue;

  const areaCode = lookupMappedValue(areaCodeOverrides, target) ?? target.areaCodes[0];
  const areaCodes = areaCodeCandidates(areaCodeOverrides, target);
  const phoneNumberId = lookupMappedValue(existingPhoneNumberIds, target);
  const existingVapiPhoneNumber = forceNewPhoneNumber
    ? undefined
    : await findExistingVapiPhoneNumber(target.locationId);
  const assistantId = lookupMappedValue(assistantIds, target) ?? extractStoredVapiAssistantId(existingVapiPhoneNumber);
  const webhookUrl = `${voiceServiceUrl}/vapi/webhook?locationId=${encodeURIComponent(target.locationId)}`;

  if (!commit) {
    results.push({
      areaCode,
      areaCodes,
      assistantId: assistantId ?? null,
      business: target.business,
      createPhoneNumber: createPhoneNumbers,
      existingPhoneNumber: existingVapiPhoneNumber?.phone_number ?? null,
      existingPhoneNumberId: existingVapiPhoneNumber?.provider_sid ?? null,
      locationId: target.locationId,
      makePrimary,
      phoneNumberId: phoneNumberId ?? null,
      status: "dry_run",
      webhookUrl,
    });
    continue;
  }

  let resolvedAssistantId = assistantId;
  if (syncAssistants) {
    const assistantResult = await voiceRequest("/vapi/sync-assistant", token, {
      assistantId,
      locationId: target.locationId,
    });
    resolvedAssistantId = assistantId ?? extractId(assistantResult.response);
    if (!resolvedAssistantId) {
      throw new Error(`Vapi assistant sync for ${target.business} did not return an assistant id.`);
    }
  }

  let phoneResult;
  let vapiPhoneNumber;
  let areaCodeUsed = null;
  let attemptedAreaCodes = [];
  let reusedExistingPhoneNumber = false;
  if (createPhoneNumbers || phoneNumberId) {
    const resolvedPhoneNumberId = phoneNumberId ?? existingVapiPhoneNumber?.provider_sid;
    reusedExistingPhoneNumber = Boolean(existingVapiPhoneNumber);
    const syncResult = await syncPhoneNumberWithAreaCodeFallback({
      areaCodes,
      body: {
        assistantId: resolvedAssistantId,
        locationId: target.locationId,
        name: `SignalHost ${target.business}`,
        numberDesiredAreaCode: createPhoneNumbers ? areaCode : undefined,
        phoneNumberId: resolvedPhoneNumberId,
      },
      createPhoneNumbers: createPhoneNumbers && !resolvedPhoneNumberId,
      token,
    });
    phoneResult = syncResult.phoneResult;
    areaCodeUsed = syncResult.areaCodeUsed;
    attemptedAreaCodes = syncResult.attemptedAreaCodes;
    vapiPhoneNumber = extractVapiPhoneNumber(phoneResult.response);

    if (vapiPhoneNumber?.phoneNumber && vapiPhoneNumber?.providerSid) {
      await upsertVapiPhoneNumber(target, {
        assistantId: resolvedAssistantId,
        phoneNumber: vapiPhoneNumber.phoneNumber,
        providerSid: vapiPhoneNumber.providerSid,
        webhookUrl,
      });
      if (makePrimary) {
        await patchLocationPrimaryPhone(target.locationId, vapiPhoneNumber.phoneNumber);
      }
    }
  }

  results.push({
    areaCodeUsed,
    attemptedAreaCodes,
    assistantId: resolvedAssistantId ?? null,
    business: target.business,
    locationId: target.locationId,
    makePrimary,
    phoneNumber: vapiPhoneNumber?.phoneNumber ?? null,
    phoneNumberId: vapiPhoneNumber?.providerSid ?? phoneNumberId ?? null,
    reusedExistingPhoneNumber,
    status: vapiPhoneNumber ? "vapi_phone_synced" : syncAssistants ? "assistant_synced" : "no_changes_requested",
    webhookUrl,
  });
}

console.log(JSON.stringify({
  commit,
  createPhoneNumbers,
  makePrimary,
  results,
  syncAssistants,
  voiceServiceUrl,
}, null, 2));

function findArgValue(name) {
  const arg = args.find((value) => value.startsWith(`${name}=`));
  return arg?.slice(name.length + 1);
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

function parseInclude(raw) {
  return new Set(String(raw ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean));
}

function parseMapping(raw) {
  const result = new Map();
  if (!raw) return result;
  for (const part of raw.split(",")) {
    const separator = part.indexOf(":");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (key && value) result.set(key, value);
  }
  return result;
}

function targetMatchesInclude(target, include) {
  const values = new Set([
    target.business.toLowerCase(),
    target.vertical.toLowerCase(),
    ...target.aliases.map((alias) => alias.toLowerCase()),
  ]);
  return [...include].some((value) => values.has(value));
}

function lookupMappedValue(mapping, target) {
  for (const key of [target.vertical, target.business.toLowerCase(), ...target.aliases]) {
    const value = mapping.get(key.toLowerCase());
    if (value) return value;
  }
  return undefined;
}

function areaCodeCandidates(mapping, target) {
  const override = lookupMappedValue(mapping, target);
  return uniqueValues([override, ...target.areaCodes].filter(Boolean));
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

async function voiceRequest(path, token, body) {
  const response = await fetch(`${voiceServiceUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Voice service ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function findExistingVapiPhoneNumber(locationId) {
  const rows = await supabaseRequest(
    `phone_numbers?select=phone_number,provider_sid,status,updated_at,verification_results&location_id=eq.${encodeURIComponent(locationId)}&provider=eq.vapi&status=eq.active&order=updated_at.desc&limit=1`,
    token,
  );
  return Array.isArray(rows) ? rows[0] : undefined;
}

function extractStoredVapiAssistantId(row) {
  const results = row?.verification_results;
  if (!results || typeof results !== "object" || Array.isArray(results)) return undefined;
  return stringValue(results.vapiAssistantId) ?? stringValue(results.assistantId);
}

async function syncPhoneNumberWithAreaCodeFallback({ areaCodes, body, createPhoneNumbers, token }) {
  if (!createPhoneNumbers || body.phoneNumberId) {
    return {
      areaCodeUsed: null,
      attemptedAreaCodes: [],
      phoneResult: await voiceRequest("/vapi/sync-phone-number", token, body),
    };
  }

  const candidates = uniqueValues([...areaCodes, undefined]);
  const attemptedAreaCodes = [];
  const errors = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const areaCode = candidates[index];
    attemptedAreaCodes.push(areaCode ?? "any");

    try {
      const phoneResult = await voiceRequest("/vapi/sync-phone-number", token, {
        ...body,
        numberDesiredAreaCode: areaCode,
      });
      return {
        areaCodeUsed: areaCode ?? null,
        attemptedAreaCodes,
        phoneResult,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      for (const suggestedAreaCode of parseSuggestedAreaCodes(message)) {
        if (!candidates.includes(suggestedAreaCode)) candidates.push(suggestedAreaCode);
      }
    }
  }

  throw new Error(`Could not create Vapi number after area-code attempts ${attemptedAreaCodes.join(", ")}. Last error: ${errors.at(-1)}`);
}

function parseSuggestedAreaCodes(message) {
  const match = message.match(/Try one of\s+([0-9,\s]+)/i);
  if (!match) return [];
  return uniqueValues(match[1].split(",").map((value) => value.trim()).filter(Boolean));
}

function uniqueValues(values) {
  return [...new Set(values)];
}

async function supabaseRequest(path, token, { body, headers = {}, method = "GET" } = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    method,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}

async function upsertVapiPhoneNumber(target, { assistantId, phoneNumber, providerSid, webhookUrl }) {
  const now = new Date();
  const trialEndsAt = addDays(now, 7);
  const trialGraceEndsAt = addDays(trialEndsAt, 14);
  await supabaseRequest("phone_numbers?on_conflict=provider,phone_number", token, {
    body: {
      capabilities: { sms: false, vapi: true, voice: true },
      forwarding_mode: "vapi_managed",
      forwarding_status: "verified",
      location_id: target.locationId,
      phone_number: phoneNumber,
      provider: "vapi",
      provider_sid: providerSid,
      provisioning_source: "vapi_demo",
      released_at: null,
      release_reason: null,
      restaurant_main_line: null,
      sms_webhook_url: null,
      status: "active",
      trial_ends_at: trialEndsAt.toISOString(),
      trial_grace_ends_at: trialGraceEndsAt.toISOString(),
      trial_started_at: now.toISOString(),
      updated_at: now.toISOString(),
      verification_results: {
        vapiAssistantId: assistantId,
        vapiPhoneNumberId: providerSid,
      },
      voice_webhook_url: webhookUrl,
    },
    headers: {
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    method: "POST",
  });
}

async function patchLocationPrimaryPhone(locationId, phoneNumber) {
  await supabaseRequest(`locations?id=eq.${encodeURIComponent(locationId)}`, token, {
    body: {
      ai_host_phone: phoneNumber,
    },
    headers: {
      Prefer: "return=minimal",
    },
    method: "PATCH",
  });
}

function extractId(value) {
  if (!value || typeof value !== "object") return undefined;
  const record = value;
  if (typeof record.id === "string") return record.id;
  if (record.assistant && typeof record.assistant === "object" && typeof record.assistant.id === "string") {
    return record.assistant.id;
  }
  if (record.data && typeof record.data === "object" && typeof record.data.id === "string") {
    return record.data.id;
  }
  return undefined;
}

function extractVapiPhoneNumber(value) {
  if (!value || typeof value !== "object") return undefined;
  const record = value;
  const providerSid = stringValue(record.id) ?? stringValue(record.phoneNumberId);
  const phoneNumber = normalizePhone(stringValue(record.number) ?? stringValue(record.phoneNumber));
  if (!providerSid || !phoneNumber) return undefined;
  return { phoneNumber, providerSid };
}

function normalizePhone(value) {
  if (!value) return undefined;
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.trim();
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}
