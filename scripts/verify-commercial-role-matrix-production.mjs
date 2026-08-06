import fs from "node:fs";

const fixture = {
  directOrganizationId: "0125aaa8-d9cf-41c6-814b-488bac63249e",
  locationId: "c0000000-0000-4000-8000-000000000100",
  organizationId: "b0000000-0000-4000-8000-000000000100",
  partnerId: "a0000000-0000-4000-8000-000000000100",
  restrictedDepartmentId: "d0000000-0000-4000-8000-000000000100",
  requestId: "f0000000-0000-4000-8000-000000000100",
};

const roleDefinitions = [
  { key: "owner", emailEnv: "SIGNALHOST_ROLE_OWNER_EMAIL", email: "qa.org-owner@signalhost.ai", organizationRole: "owner" },
  { key: "admin", emailEnv: "SIGNALHOST_ROLE_ADMIN_EMAIL", email: "qa.org-admin@signalhost.ai", organizationRole: "admin" },
  { key: "manager", emailEnv: "SIGNALHOST_ROLE_MANAGER_EMAIL", email: "qa.org-manager@signalhost.ai", organizationRole: "manager" },
  { key: "staff", emailEnv: "SIGNALHOST_ROLE_STAFF_EMAIL", email: "qa.org-staff@signalhost.ai", organizationRole: "staff" },
  { key: "department_manager", emailEnv: "SIGNALHOST_DEPARTMENT_MANAGER_EMAIL", email: "qa.department-manager@signalhost.ai", organizationRole: "staff", departmentRole: "manager" },
  { key: "department_agent", emailEnv: "SIGNALHOST_DEPARTMENT_AGENT_EMAIL", email: "qa.department-agent@signalhost.ai", organizationRole: "staff", departmentRole: "agent" },
  { key: "department_viewer", emailEnv: "SIGNALHOST_DEPARTMENT_VIEWER_EMAIL", email: "qa.department-viewer@signalhost.ai", organizationRole: "staff", departmentRole: "viewer" },
];

const env = { ...loadEnv(), ...process.env };
const supabaseUrl = (env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const sharedPassword = env.SIGNALHOST_ROLE_MATRIX_PASSWORD;
const accounts = roleDefinitions.map((definition) => ({
  ...definition,
  email: env[definition.emailEnv] ?? definition.email,
  password: env[`${definition.emailEnv.replace(/_EMAIL$/, "")}_PASSWORD`] ?? sharedPassword,
}));

if (!supabaseUrl || !publishableKey) {
  console.error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
  process.exit(1);
}

if (accounts.some((account) => !account.password)) {
  console.error("Missing role-matrix credentials. Set SIGNALHOST_ROLE_MATRIX_PASSWORD or the per-identity password variables in ignored local environment configuration.");
  process.exit(1);
}

const failures = [];
let result = null;

try {
  result = await verifyRoleMatrix();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  failures,
  note: "Positive and negative PATCH probes reuse current values and target only the isolated authorization QA fixture; allowed probes may refresh fixture updated_at timestamps.",
  passed: failures.length === 0,
  result,
}, null, 2));

if (failures.length > 0) process.exit(2);

async function verifyRoleMatrix() {
  const snapshots = await Promise.all(accounts.map(collectSnapshot));
  const byKey = new Map(snapshots.map((snapshot) => [snapshot.key, snapshot]));
  const viewerMembership = byKey.get("department_viewer")?.data.departmentMemberships[0];
  assert(viewerMembership, "Role matrix: department viewer membership is unavailable for membership write probes.");

  const rows = {
    customer_requests: { id: fixture.requestId, patch: { title: byKey.get("owner").data.requests[0].title } },
    default_department: {
      id: byKey.get("owner").defaultDepartment.id,
      patch: { name: byKey.get("owner").defaultDepartment.name },
      table: "departments",
    },
    department_memberships: { id: viewerMembership.id, patch: { role: viewerMembership.role } },
    locations: { id: fixture.locationId, patch: { name: byKey.get("owner").data.locations[0].name } },
    organizations: { id: fixture.organizationId, patch: { name: byKey.get("owner").data.organizations[0].name } },
    restricted_department: {
      id: fixture.restrictedDepartmentId,
      patch: { name: byKey.get("owner").restrictedDepartment.name },
      table: "departments",
    },
    restricted_queue: {
      id: byKey.get("owner").restrictedQueue.id,
      patch: { name: byKey.get("owner").restrictedQueue.name },
      table: "queues",
    },
  };

  const writeResults = [];
  for (const snapshot of snapshots) {
    verifySnapshot(snapshot);
    await verifyPredicates(snapshot, rows.restricted_queue.id);
    writeResults.push(await verifyWrites(snapshot, rows));
  }

  return {
    fixture: {
      locationId: fixture.locationId,
      organizationId: fixture.organizationId,
      partnerId: fixture.partnerId,
      restrictedDepartmentId: fixture.restrictedDepartmentId,
    },
    roles: snapshots.map((snapshot) => ({
      departmentRole: snapshot.departmentRole ?? null,
      key: snapshot.key,
      organizationRole: snapshot.organizationRole,
      visibleDepartments: snapshot.data.departments.length,
      visibleQueues: snapshot.data.queues.length,
    })),
    writeResults,
  };
}

async function collectSnapshot(account) {
  const session = await signIn(account.email, account.password);
  const token = session.access_token;
  const userId = session.user?.id;
  assert(userId, `${account.key}: authentication did not return a user id.`);

  const [
    partners,
    partnerMemberships,
    organizationMemberships,
    departmentMemberships,
    organizations,
    locations,
    departments,
    queues,
    requests,
    directOrganizations,
  ] = await Promise.all([
    rest("channel_partners?select=id,name,status,is_internal", token),
    rest(`partner_memberships?select=id,partner_id,user_id,role&user_id=eq.${encodeURIComponent(userId)}`, token),
    rest(`user_memberships?select=id,user_id,organization_id,role&user_id=eq.${encodeURIComponent(userId)}`, token),
    rest(`department_memberships?select=id,user_id,department_id,role&user_id=eq.${encodeURIComponent(userId)}`, token),
    rest("organizations?select=id,name,channel_partner_id", token),
    rest("locations?select=id,name,organization_id", token),
    rest("departments?select=id,name,location_id,access_mode,is_default", token),
    rest("queues?select=id,name,department_id,routing_mode,is_default", token),
    rest(`customer_requests?select=id,location_id,title,status&id=eq.${fixture.requestId}`, token),
    rest(`organizations?select=id&id=eq.${fixture.directOrganizationId}`, token),
  ]);

  return {
    ...account,
    data: {
      departmentMemberships,
      departments,
      directOrganizations,
      locations,
      organizationMemberships,
      organizations,
      partnerMemberships,
      partners,
      queues,
      requests,
    },
    defaultDepartment: departments.find((row) => row.is_default),
    restrictedDepartment: departments.find((row) => row.id === fixture.restrictedDepartmentId),
    restrictedQueue: queues.find((row) => row.department_id === fixture.restrictedDepartmentId && row.is_default),
    token,
    userId,
  };
}

function verifySnapshot(snapshot) {
  const { data } = snapshot;
  assert(data.partners.length === 1 && data.partners[0]?.id === fixture.partnerId, `${snapshot.key}: wrong partner scope.`);
  assert(data.partnerMemberships.length === 0, `${snapshot.key}: role fixture must not use partner membership.`);
  assert(data.organizationMemberships.length === 1, `${snapshot.key}: expected exactly one organization membership.`);
  assert(data.organizationMemberships[0]?.organization_id === fixture.organizationId, `${snapshot.key}: wrong organization membership.`);
  assert(data.organizationMemberships[0]?.role === snapshot.organizationRole, `${snapshot.key}: wrong organization role.`);
  assert(data.organizations.length === 1 && data.organizations[0]?.id === fixture.organizationId, `${snapshot.key}: wrong organization visibility.`);
  assert(data.locations.length === 1 && data.locations[0]?.id === fixture.locationId, `${snapshot.key}: wrong location visibility.`);
  assert(snapshot.defaultDepartment?.access_mode === "inherit_location", `${snapshot.key}: inherited default department is missing.`);
  assert(data.requests.length === 1, `${snapshot.key}: location operational fixture is not visible.`);
  assert(data.directOrganizations.length === 0, `${snapshot.key}: SignalHost Direct organization leaked into the QA tenant.`);

  const expectsRestrictedAccess = snapshot.organizationRole === "owner" || snapshot.organizationRole === "admin" || Boolean(snapshot.departmentRole);
  assert(Boolean(snapshot.restrictedDepartment) === expectsRestrictedAccess, `${snapshot.key}: restricted department visibility mismatch.`);
  assert(Boolean(snapshot.restrictedQueue) === expectsRestrictedAccess, `${snapshot.key}: restricted queue visibility mismatch.`);
  assert(data.departmentMemberships.length === (snapshot.departmentRole ? 1 : 0), `${snapshot.key}: unexpected department membership count.`);
  if (snapshot.departmentRole) {
    assert(data.departmentMemberships[0]?.department_id === fixture.restrictedDepartmentId, `${snapshot.key}: department membership is attached to the wrong department.`);
    assert(data.departmentMemberships[0]?.role === snapshot.departmentRole, `${snapshot.key}: wrong department role.`);
  }
}

async function verifyPredicates(snapshot, restrictedQueueId) {
  const organizationManage = snapshot.organizationRole === "owner" || snapshot.organizationRole === "admin";
  await expectRpc(snapshot, "organization_role", { target_organization_id: fixture.organizationId }, snapshot.organizationRole);
  await expectCapability(snapshot, "can_access_organization", { target_organization_id: fixture.organizationId }, true);
  await expectCapability(snapshot, "can_manage_organization", { target_organization_id: fixture.organizationId }, organizationManage);
  await expectCapability(snapshot, "can_operate_organization", { target_organization_id: fixture.organizationId }, true);
  await expectCapability(snapshot, "can_access_location", { target_location_id: fixture.locationId }, true);
  await expectCapability(snapshot, "can_manage_location", { target_location_id: fixture.locationId }, organizationManage);
  await expectCapability(snapshot, "can_operate_location", { target_location_id: fixture.locationId }, true);

  await expectCapability(snapshot, "can_access_department", { target_department_id: snapshot.defaultDepartment.id }, true);
  await expectCapability(snapshot, "can_manage_department", { target_department_id: snapshot.defaultDepartment.id }, organizationManage);
  await expectCapability(snapshot, "can_operate_department", { target_department_id: snapshot.defaultDepartment.id }, true);

  const restrictedAccess = organizationManage || Boolean(snapshot.departmentRole);
  const restrictedManage = organizationManage || snapshot.departmentRole === "manager";
  const restrictedOperate = organizationManage || snapshot.departmentRole === "manager" || snapshot.departmentRole === "agent";
  await expectCapability(snapshot, "can_access_department", { target_department_id: fixture.restrictedDepartmentId }, restrictedAccess);
  await expectCapability(snapshot, "can_manage_department", { target_department_id: fixture.restrictedDepartmentId }, restrictedManage);
  await expectCapability(snapshot, "can_operate_department", { target_department_id: fixture.restrictedDepartmentId }, restrictedOperate);

  await expectCapability(snapshot, "can_access_queue", { target_queue_id: restrictedQueueId }, restrictedAccess);
  await expectCapability(snapshot, "can_manage_queue", { target_queue_id: restrictedQueueId }, restrictedManage);
  await expectCapability(snapshot, "can_operate_queue", { target_queue_id: restrictedQueueId }, restrictedOperate);

  await expectRpc(snapshot, "organization_role", { target_organization_id: fixture.directOrganizationId }, null);
  await expectDeniedRpc(snapshot, "can_access_organization", { target_organization_id: fixture.directOrganizationId });
  await expectDeniedRpc(snapshot, "can_manage_organization", { target_organization_id: fixture.directOrganizationId });
  await expectDeniedRpc(snapshot, "can_operate_organization", { target_organization_id: fixture.directOrganizationId });
}

async function verifyWrites(snapshot, rows) {
  const organizationManage = snapshot.organizationRole === "owner" || snapshot.organizationRole === "admin";
  const restrictedManage = organizationManage || snapshot.departmentRole === "manager";
  const expectations = {
    customer_requests: true,
    default_department: organizationManage,
    department_memberships: restrictedManage,
    locations: organizationManage,
    organizations: organizationManage,
    restricted_department: organizationManage,
    restricted_queue: restrictedManage,
  };

  const allowed = [];
  const denied = [];
  for (const [label, row] of Object.entries(rows)) {
    const table = row.table ?? label;
    const returnedRows = await patchReturningRows(table, row.id, row.patch, snapshot.token);
    const expected = expectations[label];
    assert(returnedRows.length === (expected ? 1 : 0), `${snapshot.key}: ${label} write expectation failed.`);
    (expected ? allowed : denied).push(label);
  }

  const directWrite = await patchReturningRows("organizations", fixture.directOrganizationId, { name: "Olive & Ember" }, snapshot.token);
  assert(directWrite.length === 0, `${snapshot.key}: cross-partner organization write was allowed.`);
  denied.push("cross_partner_organization");

  return { allowed, denied, key: snapshot.key };
}

async function expectRpc(snapshot, functionName, body, expected) {
  const value = await rpc(functionName, body, snapshot.token);
  assert(value === expected, `${snapshot.key}: ${functionName} expected ${String(expected)}, received ${String(value)}.`);
}

async function expectCapability(snapshot, functionName, body, expected) {
  const value = await rpc(functionName, body, snapshot.token);
  const matches = expected ? value === true : value !== true;
  assert(matches, `${snapshot.key}: ${functionName} expected ${String(expected)}, received ${String(value)}.`);
}

async function expectDeniedRpc(snapshot, functionName, body) {
  const value = await rpc(functionName, body, snapshot.token);
  assert(value !== true, `${snapshot.key}: ${functionName} unexpectedly returned true.`);
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
    headers: { apikey: publishableKey, "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error(`Authentication failed for ${email} (${response.status}).`);
  return response.json();
}

async function rest(path, token) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: publishableKey, authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path.split("?")[0]} returned ${response.status}: ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : [];
}

async function rpc(functionName, body, token) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: { apikey: publishableKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
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
