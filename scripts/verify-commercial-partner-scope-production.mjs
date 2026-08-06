import fs from "node:fs";

const directPartner = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "SignalHost Direct",
};

const controlPartner = {
  id: "a0000000-0000-4000-8000-000000000099",
  name: "SignalHost Partner Isolation Control",
};

const env = { ...loadEnv(), ...process.env };
const supabaseUrl = (env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const demoPassword = env.SIGNALHOST_DEMO_PASSWORD;

const accounts = {
  control: {
    email: env.SIGNALHOST_PARTNER_CONTROL_EMAIL ?? "demo.partner-control@signalhost.ai",
    label: "Partner isolation control",
    partner: controlPartner,
    password: env.SIGNALHOST_PARTNER_CONTROL_PASSWORD ?? demoPassword,
  },
  direct: {
    email: env.SIGNALHOST_PARTNER_TEST_EMAIL ?? "demo.partner@signalhost.ai",
    label: "SignalHost Direct partner owner",
    partner: directPartner,
    password: env.SIGNALHOST_PARTNER_TEST_PASSWORD ?? demoPassword,
  },
};

if (!supabaseUrl || !publishableKey) {
  console.error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
  process.exit(1);
}

if (!accounts.direct.password || !accounts.control.password) {
  console.error("Missing partner verification credentials. Set SIGNALHOST_PARTNER_TEST_PASSWORD and SIGNALHOST_PARTNER_CONTROL_PASSWORD (or SIGNALHOST_DEMO_PASSWORD) in ignored local environment configuration.");
  process.exit(1);
}

const failures = [];
let result = null;

try {
  result = await verifyPartnerScope();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  failures,
  note: "Partner positive access uses read-only RLS RPCs; cross-partner write probes reuse current values and must return no rows.",
  passed: failures.length === 0,
  result,
}, null, 2));

if (failures.length > 0) process.exit(2);

async function verifyPartnerScope() {
  const [directSnapshot, controlSnapshot] = await Promise.all([
    collectSnapshot(accounts.direct),
    collectSnapshot(accounts.control),
  ]);

  verifyDirectPartnerSnapshot(directSnapshot);
  verifyControlPartnerSnapshot(controlSnapshot);

  await verifyPositivePartnerPredicates(directSnapshot, controlSnapshot);

  const deniedBoundaries = [
    ...(await verifyDeniedNoOpUpdates(controlSnapshot, directSnapshot.rows)),
    ...(await verifyDeniedNoOpUpdates(directSnapshot, {
      channel_partners: {
        id: controlPartner.id,
        patch: { name: controlPartner.name },
      },
    })),
  ];

  return {
    controlPartner: summarize(controlSnapshot),
    deniedBoundaries,
    directPartner: summarize(directSnapshot),
  };
}

async function collectSnapshot(account) {
  const session = await signIn(account.email, account.password);
  const token = session.access_token;
  const userId = session.user?.id;
  assert(userId, `${account.label}: authentication did not return a user id.`);
  const [
    partners,
    partnerMemberships,
    customerMemberships,
    organizations,
    locations,
    departments,
    queues,
    phoneNumbers,
    numberRoutes,
    telephonyAccounts,
    sipTrunks,
  ] = await Promise.all([
    rest("channel_partners?select=id,name,partner_type,status,is_internal", token),
    rest(`partner_memberships?select=id,partner_id,user_id,role&user_id=eq.${encodeURIComponent(userId)}`, token),
    rest(`user_memberships?select=id,user_id,organization_id,role&user_id=eq.${encodeURIComponent(userId)}`, token),
    rest("organizations?select=id,name,channel_partner_id", token),
    rest("locations?select=id,name,organization_id", token),
    rest("departments?select=id,name,location_id,is_default", token),
    rest("queues?select=id,name,department_id,is_default", token),
    rest("phone_numbers?select=id,location_id,status,telephony_account_id", token),
    rest("number_routes?select=id,phone_number_id,department_id,is_primary", token),
    rest("telephony_accounts?select=id,channel_partner_id,status", token),
    rest("sip_trunks?select=id,telephony_account_id,status", token),
  ]);

  return {
    ...account,
    data: {
      customerMemberships,
      departments,
      locations,
      numberRoutes,
      organizations,
      partnerMemberships,
      partners,
      phoneNumbers,
      queues,
      sipTrunks,
      telephonyAccounts,
    },
    rows: buildProbeRows({
      departments,
      locations,
      numberRoutes,
      organizations,
      partners,
      phoneNumbers,
      queues,
      telephonyAccounts,
    }),
    token,
  };
}

function verifyDirectPartnerSnapshot(snapshot) {
  const { data } = snapshot;
  assert(data.partners.length === 1, `Direct partner: expected one visible partner, found ${data.partners.length}.`);
  assert(data.partners[0]?.id === directPartner.id, "Direct partner: wrong partner is visible.");
  assert(data.partnerMemberships.length === 1, "Direct partner: expected exactly one partner membership.");
  assert(data.partnerMemberships[0]?.partner_id === directPartner.id, "Direct partner: membership is attached to the wrong partner.");
  assert(data.partnerMemberships[0]?.role === "owner", "Direct partner: controlled identity is not an owner.");
  assert(data.customerMemberships.length === 0, "Direct partner: controlled identity also has customer membership access.");
  assert(data.organizations.length >= 2, "Direct partner: expected at least two visible customer organizations.");
  assertOnly(data.organizations, (row) => row.channel_partner_id === directPartner.id, "Direct partner: cross-partner organization visibility detected.");

  const organizationIds = new Set(data.organizations.map((row) => row.id));
  const locationIds = new Set(data.locations.map((row) => row.id));
  const departmentIds = new Set(data.departments.map((row) => row.id));
  const phoneNumberIds = new Set(data.phoneNumbers.map((row) => row.id));
  const telephonyAccountIds = new Set(data.telephonyAccounts.map((row) => row.id));

  assert(data.locations.length >= 2, "Direct partner: expected at least two visible customer locations.");
  assertOnly(data.locations, (row) => organizationIds.has(row.organization_id), "Direct partner: location escaped the visible organization scope.");
  assertOnly(data.departments, (row) => locationIds.has(row.location_id), "Direct partner: department escaped the visible location scope.");
  assertOnly(data.queues, (row) => departmentIds.has(row.department_id), "Direct partner: queue escaped the visible department scope.");
  assertOnly(data.phoneNumbers, (row) => locationIds.has(row.location_id), "Direct partner: phone number escaped the visible location scope.");
  assertOnly(data.numberRoutes, (row) => phoneNumberIds.has(row.phone_number_id), "Direct partner: route escaped the visible phone-number scope.");
  assertOnly(data.numberRoutes, (row) => departmentIds.has(row.department_id), "Direct partner: route escaped the visible department scope.");
  assert(data.telephonyAccounts.length > 0, "Direct partner: expected partner-visible telephony accounts.");
  assertOnly(data.telephonyAccounts, (row) => row.channel_partner_id === directPartner.id, "Direct partner: cross-partner telephony account visibility detected.");
  assertOnly(data.sipTrunks, (row) => telephonyAccountIds.has(row.telephony_account_id), "Direct partner: SIP trunk escaped the visible account scope.");
}

function verifyControlPartnerSnapshot(snapshot) {
  const { data } = snapshot;
  assert(data.partners.length === 1, `Control partner: expected one visible partner, found ${data.partners.length}.`);
  assert(data.partners[0]?.id === controlPartner.id, "Control partner: wrong partner is visible.");
  assert(data.partnerMemberships.length === 1, "Control partner: expected exactly one partner membership.");
  assert(data.partnerMemberships[0]?.partner_id === controlPartner.id, "Control partner: membership is attached to the wrong partner.");
  assert(data.partnerMemberships[0]?.role === "owner", "Control partner: controlled identity is not an owner.");
  assert(data.customerMemberships.length === 0, "Control partner: controlled identity also has customer membership access.");

  for (const [label, rows] of Object.entries({
    departments: data.departments,
    locations: data.locations,
    numberRoutes: data.numberRoutes,
    organizations: data.organizations,
    phoneNumbers: data.phoneNumbers,
    queues: data.queues,
    sipTrunks: data.sipTrunks,
    telephonyAccounts: data.telephonyAccounts,
  })) {
    assert(rows.length === 0, `Control partner: ${label} exposed ${rows.length} cross-partner rows.`);
  }
}

async function verifyPositivePartnerPredicates(directSnapshot, controlSnapshot) {
  assert(await rpc("partner_role", { target_partner_id: directPartner.id }, directSnapshot.token) === "owner", "Direct partner: partner_role did not return owner.");
  assert(await rpc("can_access_partner", { target_partner_id: directPartner.id }, directSnapshot.token) === true, "Direct partner: access predicate failed.");
  assert(await rpc("can_manage_partner", { target_partner_id: directPartner.id }, directSnapshot.token) === true, "Direct partner: manage predicate failed.");
  assert(await rpc("can_operate_partner", { target_partner_id: directPartner.id }, directSnapshot.token) === true, "Direct partner: operate predicate failed.");

  for (const organization of directSnapshot.data.organizations) {
    assert(await rpc("can_access_organization", { target_organization_id: organization.id }, directSnapshot.token) === true, `Direct partner: cannot access ${organization.name}.`);
    assert(await rpc("can_manage_organization", { target_organization_id: organization.id }, directSnapshot.token) === true, `Direct partner: cannot manage ${organization.name}.`);
    assert(await rpc("can_operate_organization", { target_organization_id: organization.id }, directSnapshot.token) === true, `Direct partner: cannot operate ${organization.name}.`);
  }

  assert(await rpc("partner_role", { target_partner_id: controlPartner.id }, directSnapshot.token) === null, "Direct partner: acquired a role in the control partner.");
  assert(await rpc("can_access_partner", { target_partner_id: controlPartner.id }, directSnapshot.token) === false, "Direct partner: can access the control partner.");
  assert(await rpc("partner_role", { target_partner_id: controlPartner.id }, controlSnapshot.token) === "owner", "Control partner: partner_role did not return owner.");
  assert(await rpc("can_manage_partner", { target_partner_id: controlPartner.id }, controlSnapshot.token) === true, "Control partner: manage predicate failed.");
  assert(await rpc("partner_role", { target_partner_id: directPartner.id }, controlSnapshot.token) === null, "Control partner: acquired a role in SignalHost Direct.");
  assert(await rpc("can_access_partner", { target_partner_id: directPartner.id }, controlSnapshot.token) === false, "Control partner: can access SignalHost Direct.");

  for (const organization of directSnapshot.data.organizations) {
    assert(await rpc("can_access_organization", { target_organization_id: organization.id }, controlSnapshot.token) === false, `Control partner: can access ${organization.name}.`);
    assert(await rpc("can_manage_organization", { target_organization_id: organization.id }, controlSnapshot.token) !== true, `Control partner: can manage ${organization.name}.`);
    assert(await rpc("can_operate_organization", { target_organization_id: organization.id }, controlSnapshot.token) !== true, `Control partner: can operate ${organization.name}.`);
  }
}

function buildProbeRows(data) {
  const rows = {};
  const partner = data.partners[0];
  const organization = data.organizations[0];
  const location = data.locations[0];
  const department = data.departments.find((row) => row.is_default) ?? data.departments[0];
  const queue = data.queues.find((row) => row.is_default) ?? data.queues[0];
  const phoneNumber = data.phoneNumbers[0];
  const numberRoute = data.numberRoutes.find((row) => row.is_primary) ?? data.numberRoutes[0];
  const telephonyAccount = data.telephonyAccounts[0];

  if (partner) rows.channel_partners = { id: partner.id, patch: { name: partner.name } };
  if (organization) rows.organizations = { id: organization.id, patch: { name: organization.name } };
  if (location) rows.locations = { id: location.id, patch: { name: location.name } };
  if (department) rows.departments = { id: department.id, patch: { name: department.name } };
  if (queue) rows.queues = { id: queue.id, patch: { name: queue.name } };
  if (phoneNumber) rows.phone_numbers = { id: phoneNumber.id, patch: { status: phoneNumber.status } };
  if (numberRoute) rows.number_routes = { id: numberRoute.id, patch: { is_primary: numberRoute.is_primary } };
  if (telephonyAccount) rows.telephony_accounts = { id: telephonyAccount.id, patch: { status: telephonyAccount.status } };

  return rows;
}

async function verifyDeniedNoOpUpdates(attacker, targetRows) {
  const denied = [];
  for (const [table, row] of Object.entries(targetRows)) {
    const rows = await patchReturningRows(table, row.id, row.patch, attacker.token);
    assert(rows.length === 0, `${attacker.label}: ${table} exposed a writable cross-partner row.`);
    denied.push(`${attacker.partner.name} -> ${table}`);
  }
  return denied;
}

function summarize(snapshot) {
  return {
    departments: snapshot.data.departments.length,
    locations: snapshot.data.locations.length,
    numberRoutes: snapshot.data.numberRoutes.length,
    organizations: snapshot.data.organizations.length,
    partnerId: snapshot.partner.id,
    phoneNumbers: snapshot.data.phoneNumbers.length,
    queues: snapshot.data.queues.length,
    sipTrunks: snapshot.data.sipTrunks.length,
    telephonyAccounts: snapshot.data.telephonyAccounts.length,
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

  if (!response.ok) throw new Error(`Authentication failed for ${email} (${response.status}).`);
  return response.json();
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

async function rpc(functionName, body, token) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${functionName} RPC returned ${response.status}: ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
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
