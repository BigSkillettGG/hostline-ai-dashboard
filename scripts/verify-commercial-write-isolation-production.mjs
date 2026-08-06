import fs from "node:fs";

const demoAccounts = [
  { business: "Olive & Ember", email: "demo.restaurant@signalhost.ai" },
  { business: "Summit Air", email: "demo.hvac@signalhost.ai" },
  { business: "Harbor Plumbing", email: "demo.plumbing@signalhost.ai" },
  { business: "RidgeLine Roofing", email: "demo.roofing@signalhost.ai" },
  { business: "BrightWire Electric", email: "demo.electrical@signalhost.ai" },
  { business: "Luna Studio", email: "demo.salon@signalhost.ai" },
];

const env = { ...loadEnv(), ...process.env };
const supabaseUrl = (env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const demoPassword = env.SIGNALHOST_DEMO_PASSWORD ?? "SignalHostDemo!2026";

if (!supabaseUrl || !publishableKey) {
  console.error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
  process.exit(1);
}

const failures = [];
const snapshots = [];

for (const account of demoAccounts) {
  try {
    snapshots.push(await collectSnapshot(account));
  } catch (error) {
    failures.push({
      business: account.business,
      stage: "snapshot",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const results = [];
if (failures.length === 0) {
  for (let index = 0; index < snapshots.length; index += 1) {
    const attacker = snapshots[index];
    const target = snapshots[(index + 1) % snapshots.length];

    try {
      results.push(await verifyDeniedNoOpUpdates(attacker, target));
    } catch (error) {
      failures.push({
        business: attacker.business,
        stage: "write-isolation",
        target: target.business,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  failures,
  note: "Authenticated cross-tenant PATCH probes reuse each target's current values; correct RLS returns no rows and no business data changes.",
  passed: failures.length === 0,
  tenants: results,
}, null, 2));

if (failures.length > 0) process.exit(2);

async function collectSnapshot(account) {
  const token = await signIn(account.email, demoPassword);
  const [partners, organizations, locations, departments, queues, phoneNumbers, numberRoutes] = await Promise.all([
    rest("channel_partners?select=id,name", token),
    rest("organizations?select=id,name", token),
    rest("locations?select=id,name", token),
    rest("departments?select=id,name,is_default", token),
    rest("queues?select=id,name,is_default", token),
    rest("phone_numbers?select=id,status,telephony_account_id", token),
    rest("number_routes?select=id,is_primary", token),
  ]);

  assert(partners.length === 1, `${account.business}: expected one visible channel partner.`);
  assert(organizations.length === 1, `${account.business}: expected one visible organization.`);
  assert(locations.length === 1, `${account.business}: expected one visible location.`);

  const department = departments.find((row) => row.is_default) ?? departments[0];
  const queue = queues.find((row) => row.is_default) ?? queues[0];
  const phoneNumber = phoneNumbers[0];
  const numberRoute = numberRoutes.find((row) => row.is_primary) ?? numberRoutes[0];

  assert(department, `${account.business}: no department is available for the write-isolation probe.`);
  assert(queue, `${account.business}: no queue is available for the write-isolation probe.`);
  assert(phoneNumber?.telephony_account_id, `${account.business}: no owned phone number/account reference is available.`);
  assert(numberRoute, `${account.business}: no number route is available for the write-isolation probe.`);

  return {
    ...account,
    token,
    rows: {
      channel_partners: { id: partners[0].id, patch: { name: partners[0].name } },
      organizations: { id: organizations[0].id, patch: { name: organizations[0].name } },
      locations: { id: locations[0].id, patch: { name: locations[0].name } },
      departments: { id: department.id, patch: { name: department.name } },
      queues: { id: queue.id, patch: { name: queue.name } },
      phone_numbers: { id: phoneNumber.id, patch: { status: phoneNumber.status } },
      number_routes: { id: numberRoute.id, patch: { is_primary: numberRoute.is_primary } },
      telephony_accounts: { id: phoneNumber.telephony_account_id, patch: { id: phoneNumber.telephony_account_id } },
    },
  };
}

async function verifyDeniedNoOpUpdates(attacker, target) {
  const deniedTables = [];

  for (const [table, row] of Object.entries(target.rows)) {
    const result = await patchReturningRows(table, row.id, row.patch, attacker.token);
    assert(
      result.length === 0,
      `${attacker.business}: ${table} exposed a writable row belonging to ${target.business}.`,
    );
    deniedTables.push(table);
  }

  return {
    business: attacker.business,
    deniedTables,
    target: target.business,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadEnv() {
  const result = {};
  for (const path of [".env.local", ".env"]) {
    if (!fs.existsSync(path)) continue;
    for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
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
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password }),
    headers: {
      apikey: publishableKey,
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) throw new Error(`Authentication failed for ${email} (${response.status}).`);
  return (await response.json()).access_token;
}

async function rest(path, token) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path.split("?")[0]} returned ${response.status}: ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : [];
}

async function patchReturningRows(table, id, patch, token) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id`, {
    body: JSON.stringify(patch),
    headers: {
      accept: "application/json",
      apikey: publishableKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    method: "PATCH",
  });
  const text = await response.text();

  if (response.status === 401 || response.status === 403) return [];
  if (!response.ok) throw new Error(`${table} PATCH returned ${response.status}: ${text.slice(0, 160)}`);

  const rows = text ? JSON.parse(text) : null;
  if (!Array.isArray(rows)) throw new Error(`${table} PATCH did not return a verifiable row array.`);
  return rows;
}
