import fs from "node:fs";

const demoAccounts = [
  {
    business: "Olive & Ember",
    email: "demo.restaurant@signalhost.ai",
    locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
  },
  {
    business: "Summit Air",
    email: "demo.hvac@signalhost.ai",
    locationId: "11111111-1111-4111-8111-111111111111",
  },
  {
    business: "Harbor Plumbing",
    email: "demo.plumbing@signalhost.ai",
    locationId: "22222222-2222-4222-8222-222222222222",
  },
  {
    business: "RidgeLine Roofing",
    email: "demo.roofing@signalhost.ai",
    locationId: "33333333-3333-4333-8333-333333333333",
  },
  {
    business: "BrightWire Electric",
    email: "demo.electrical@signalhost.ai",
    locationId: "44444444-4444-4444-8444-444444444444",
  },
  {
    business: "Luna Studio",
    email: "demo.salon@signalhost.ai",
    locationId: "55555555-5555-4555-8555-555555555555",
  },
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
const results = [];

for (const account of demoAccounts) {
  try {
    results.push(await verifyTenant(account));
  } catch (error) {
    failures.push({
      business: account.business,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  failures,
  note: "Read-only authenticated RLS and dormant-route verification; no records were changed.",
  passed: failures.length === 0,
  tenants: results,
}, null, 2));

if (failures.length > 0) process.exit(2);

async function verifyTenant(account) {
  const token = await signIn(account.email, demoPassword);
  const [
    locations,
    organizations,
    channelPartners,
    partnerMemberships,
    phoneNumbers,
    departments,
    numberRoutes,
    telephonyAccounts,
    sipTrunks,
  ] = await Promise.all([
    rest("locations?select=id,organization_id", token),
    rest("organizations?select=id,channel_partner_id", token),
    rest("channel_partners?select=id,name", token),
    rest("partner_memberships?select=id,partner_id,user_id,role", token),
    rest("phone_numbers?select=id,location_id,telephony_account_id,provider,status", token),
    rest("departments?select=id,location_id,is_default,status", token),
    rest("number_routes?select=id,phone_number_id,department_id,queue_id,sip_trunk_id,status,is_primary,runtime_enforced", token),
    rest("telephony_accounts?select=id,organization_id,location_id,resource_owner,provider_key,account_kind,status", token),
    rest("sip_trunks?select=id,telephony_account_id,status,runtime_enforced", token),
  ]);

  assert(locations.length === 1, `${account.business}: expected exactly one visible location, found ${locations.length}.`);
  assert(locations[0]?.id === account.locationId, `${account.business}: visible location does not match the signed-in tenant.`);
  assert(organizations.length === 1, `${account.business}: expected exactly one visible customer organization.`);
  assert(
    locations[0]?.organization_id === organizations[0]?.id,
    `${account.business}: location and organization scope do not agree.`,
  );
  assert(channelPartners.length === 1, `${account.business}: expected exactly one visible channel partner.`);
  assert(
    organizations[0]?.channel_partner_id === channelPartners[0]?.id,
    `${account.business}: organization and channel-partner scope do not agree.`,
  );
  assert(
    partnerMemberships.length === 0,
    `${account.business}: customer membership can see a channel-partner membership.`,
  );
  assert(phoneNumbers.length > 0, `${account.business}: no phone numbers are visible.`);
  assert(departments.some((department) => department.is_default), `${account.business}: no default department is visible.`);

  assertOnly(phoneNumbers, (row) => row.location_id === account.locationId, `${account.business}: cross-location phone-number visibility detected.`);
  assertOnly(departments, (row) => row.location_id === account.locationId, `${account.business}: cross-location department visibility detected.`);
  assertOnly(phoneNumbers, (row) => Boolean(row.telephony_account_id), `${account.business}: a phone number is missing telephony ownership.`);

  const phoneIds = new Set(phoneNumbers.map((row) => row.id));
  const departmentIds = new Set(departments.map((row) => row.id));
  assertOnly(numberRoutes, (row) => phoneIds.has(row.phone_number_id), `${account.business}: cross-tenant number-route visibility detected.`);
  assertOnly(numberRoutes, (row) => departmentIds.has(row.department_id), `${account.business}: a route references an inaccessible department.`);

  for (const phone of phoneNumbers) {
    const primaryRoutes = numberRoutes.filter((route) => route.phone_number_id === phone.id && route.is_primary);
    assert(primaryRoutes.length === 1, `${account.business}: phone ${phone.id} does not have exactly one primary route.`);
    assert(primaryRoutes[0].status === "observed", `${account.business}: compatibility route ${primaryRoutes[0].id} is not observed.`);
    assert(primaryRoutes[0].runtime_enforced === false, `${account.business}: compatibility route ${primaryRoutes[0].id} is unexpectedly runtime-enforced.`);
  }

  assert(
    telephonyAccounts.length === 0,
    `${account.business}: customer membership can see a partner-global SignalHost telephony account.`,
  );
  assert(sipTrunks.length === 0, `${account.business}: customer membership can see a partner-global SIP trunk.`);

  return {
    business: account.business,
    channelPartners: channelPartners.length,
    departments: departments.length,
    locationId: account.locationId,
    numberRoutes: numberRoutes.length,
    phoneNumbers: phoneNumbers.length,
    sipTrunksVisible: sipTrunks.length,
    telephonyAccountsVisible: telephonyAccounts.length,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertOnly(rows, predicate, message) {
  assert(rows.every(predicate), message);
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

  if (!response.ok) {
    throw new Error(`Authentication failed for ${email} (${response.status}).`);
  }

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
