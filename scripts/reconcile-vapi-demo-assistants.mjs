import fs from "node:fs";

const demoTargets = [
  {
    aliases: ["restaurant", "olive", "olive-ember"],
    business: "Olive & Ember",
    locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    vertical: "restaurant",
  },
  {
    aliases: ["hvac", "summit", "summit-air"],
    business: "Summit Air",
    locationId: "11111111-1111-4111-8111-111111111111",
    vertical: "hvac",
  },
  {
    aliases: ["plumbing", "plumber", "harbor", "harbor-plumbing"],
    business: "Harbor Plumbing",
    locationId: "22222222-2222-4222-8222-222222222222",
    vertical: "plumbing",
  },
  {
    aliases: ["roofing", "roofer", "ridgeline", "ridgeline-roofing"],
    business: "RidgeLine Roofing",
    locationId: "33333333-3333-4333-8333-333333333333",
    vertical: "roofing",
  },
  {
    aliases: ["electrical", "electrician", "brightwire", "brightwire-electric"],
    business: "BrightWire Electric",
    locationId: "44444444-4444-4444-8444-444444444444",
    vertical: "electrical",
  },
  {
    aliases: ["salon", "hair", "luna", "luna-studio"],
    business: "Luna Studio",
    locationId: "55555555-5555-4555-8555-555555555555",
    vertical: "salon",
  },
];

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const include = parseInclude(findArgValue("--include") ?? findArgValue("--business"));
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
  throw new Error("Set SIGNALHOST_ADMIN_EMAIL and SIGNALHOST_ADMIN_PASSWORD before reconciling Vapi demos.");
}

const token = await signIn(adminEmail, adminPassword);
if (!token) {
  throw new Error("Could not sign in with the SignalHost platform admin credentials.");
}

const resources = await voiceRequest("/vapi/resources", token, { method: "GET" });
const assistants = Array.isArray(resources.assistants) ? resources.assistants : [];
const phoneNumbers = Array.isArray(resources.phoneNumbers) ? resources.phoneNumbers : [];
const assignedAssistantIds = new Set(phoneNumbers.map(extractAssignedAssistantId).filter(Boolean));

const results = [];
for (const target of demoTargets) {
  if (include.size && !targetMatchesInclude(target, include)) continue;

  const expectedName = `SignalHost ${target.business}`;
  const phoneRow = await findExistingVapiPhoneNumber(target.locationId);
  const vapiPhoneNumber = findVapiPhoneNumber(phoneNumbers, phoneRow);
  const assignedAssistantId = extractAssignedAssistantId(vapiPhoneNumber);
  const storedAssistantId = extractStoredVapiAssistantId(phoneRow);
  const canonicalAssistantId = assignedAssistantId ?? storedAssistantId;
  const matchingAssistants = assistants.filter((assistant) => stringValue(assistant?.name) === expectedName);
  const duplicateAssistants = canonicalAssistantId
    ? matchingAssistants.filter((assistant) => {
        const id = stringValue(assistant?.id);
        return id && id !== canonicalAssistantId && !assignedAssistantIds.has(id);
      })
    : [];

  const deletedAssistantIds = [];
  for (const assistant of duplicateAssistants) {
    const id = stringValue(assistant?.id);
    if (!id || !commit) continue;
    await voiceRequest("/vapi/delete-assistant", token, {
      body: { assistantId: id, locationId: target.locationId },
      method: "POST",
    });
    deletedAssistantIds.push(id);
  }

  let repairedStoredAssistantId = false;
  if (commit && assignedAssistantId && phoneRow?.provider_sid && assignedAssistantId !== storedAssistantId) {
    await patchStoredVapiAssistantId(phoneRow, assignedAssistantId);
    repairedStoredAssistantId = true;
  }

  results.push({
    assignedAssistantId: assignedAssistantId ?? null,
    business: target.business,
    canonicalAssistantId: canonicalAssistantId ?? null,
    deletedAssistantIds,
    duplicateAssistantIds: duplicateAssistants.map((assistant) => stringValue(assistant?.id)).filter(Boolean),
    expectedName,
    matchingAssistantIds: matchingAssistants.map((assistant) => stringValue(assistant?.id)).filter(Boolean),
    phoneNumber: phoneRow?.phone_number ?? null,
    phoneNumberId: phoneRow?.provider_sid ?? null,
    repairedStoredAssistantId,
    storedAssistantId: storedAssistantId ?? null,
    vapiModel: summarizeModel(matchingAssistants.find((assistant) => stringValue(assistant?.id) === canonicalAssistantId)),
    vapiVoice: summarizeVoice(matchingAssistants.find((assistant) => stringValue(assistant?.id) === canonicalAssistantId)),
  });
}

console.log(JSON.stringify({
  commit,
  note: commit
    ? "Committed: unassigned duplicate demo assistants were deleted and stored assistant IDs were repaired when needed."
    : "Dry run only: add --commit to delete unassigned duplicate demo assistants and repair stored assistant IDs.",
  results,
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

function targetMatchesInclude(target, include) {
  const values = new Set([
    target.business.toLowerCase(),
    target.vertical.toLowerCase(),
    ...target.aliases.map((alias) => alias.toLowerCase()),
  ]);
  return [...include].some((value) => values.has(value));
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

async function voiceRequest(path, token, { body, method = "POST" } = {}) {
  const response = await fetch(`${voiceServiceUrl}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    method,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Voice service ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
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

async function findExistingVapiPhoneNumber(locationId) {
  const rows = await supabaseRequest(
    `phone_numbers?select=phone_number,provider_sid,status,updated_at,verification_results&location_id=eq.${encodeURIComponent(locationId)}&provider=eq.vapi&status=eq.active&order=updated_at.desc&limit=1`,
    token,
  );
  return Array.isArray(rows) ? rows[0] : undefined;
}

async function patchStoredVapiAssistantId(phoneRow, assistantId) {
  const verificationResults = {
    ...(isPlainRecord(phoneRow.verification_results) ? phoneRow.verification_results : {}),
    vapiAssistantId: assistantId,
    vapiPhoneNumberId: phoneRow.provider_sid,
  };
  await supabaseRequest(`phone_numbers?provider=eq.vapi&provider_sid=eq.${encodeURIComponent(phoneRow.provider_sid)}`, token, {
    body: {
      updated_at: new Date().toISOString(),
      verification_results: verificationResults,
    },
    headers: {
      Prefer: "return=minimal",
    },
    method: "PATCH",
  });
}

function findVapiPhoneNumber(phoneNumbers, phoneRow) {
  if (!phoneRow) return undefined;
  return phoneNumbers.find((phoneNumber) => {
    const id = stringValue(phoneNumber?.id) ?? stringValue(phoneNumber?.phoneNumberId);
    if (id && phoneRow.provider_sid && id === phoneRow.provider_sid) return true;
    const number = normalizePhone(stringValue(phoneNumber?.number) ?? stringValue(phoneNumber?.phoneNumber));
    return Boolean(number && phoneRow.phone_number && number === normalizePhone(phoneRow.phone_number));
  });
}

function extractAssignedAssistantId(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== "object") return undefined;
  const record = phoneNumber;
  return stringValue(record.assistantId)
    ?? stringValue(record.assistant_id)
    ?? stringValue(record.assistant?.id);
}

function extractStoredVapiAssistantId(row) {
  const results = row?.verification_results;
  if (!isPlainRecord(results)) return undefined;
  return stringValue(results.vapiAssistantId) ?? stringValue(results.assistantId);
}

function summarizeModel(assistant) {
  if (!assistant || typeof assistant !== "object") return null;
  const model = assistant.model;
  if (!isPlainRecord(model)) return null;
  return {
    model: stringValue(model.model) ?? null,
    provider: stringValue(model.provider) ?? null,
    temperature: typeof model.temperature === "number" ? model.temperature : null,
  };
}

function summarizeVoice(assistant) {
  if (!assistant || typeof assistant !== "object") return null;
  const voice = assistant.voice;
  if (!isPlainRecord(voice)) return null;
  return {
    provider: stringValue(voice.provider) ?? null,
    voiceId: stringValue(voice.voiceId) ?? stringValue(voice.voice_id) ?? null,
  };
}

function normalizePhone(value) {
  if (!value) return undefined;
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.trim();
}

function isPlainRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
