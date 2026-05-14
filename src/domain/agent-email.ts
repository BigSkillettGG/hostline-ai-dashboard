export const defaultAgentEmailDomain = "agents.signalhost.ai";

export interface AgentEmailIdentity {
  address: string;
  displayName: string;
  domain: string;
  localPart: string;
  routable: boolean;
}

export function buildAgentEmailIdentity(input: {
  businessName: string;
  domain?: string;
  hostName?: string;
  locationId?: string;
}): AgentEmailIdentity {
  const domain = normalizeEmailDomain(input.domain) || defaultAgentEmailDomain;
  const hostSlug = slugify(input.hostName || "signalhost");
  const businessSlug = slugify(input.businessName || "business");
  const prefix = truncateLocalPrefix([hostSlug, businessSlug].filter(Boolean).join("-") || "signalhost-business");
  const locationId = normalizeUuid(input.locationId);
  const localPart = locationId ? `${prefix}+${locationId}` : prefix;
  const hostName = input.hostName?.trim() || "SignalHost";
  const businessName = input.businessName.trim() || "your business";

  return {
    address: `${localPart}@${domain}`,
    displayName: `${hostName} at ${businessName}`,
    domain,
    localPart,
    routable: Boolean(locationId),
  };
}

export function extractLocationIdFromAgentEmail(value: string | string[] | undefined) {
  const addresses = Array.isArray(value) ? value : value ? [value] : [];

  for (const address of addresses) {
    const localPart = normalizeEmail(address)?.split("@")[0] ?? "";
    const match = localPart.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    if (match) return match[0].toLowerCase();
  }

  return undefined;
}

function truncateLocalPrefix(value: string) {
  return value
    .slice(0, 24)
    .replace(/^-+|-+$/g, "") || "signalhost";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEmailDomain(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/^mailto:/, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "");
}

function normalizeUuid(value?: string) {
  const match = value?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match?.[0].toLowerCase();
}

function normalizeEmail(value?: string) {
  return value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim().toLowerCase();
}
