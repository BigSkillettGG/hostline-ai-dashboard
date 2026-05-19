import type { VoiceServiceEnv } from "./env";
import type { RestaurantVoiceContext } from "./restaurant-context";

type AddressEnv = Pick<VoiceServiceEnv, "GOOGLE_MAPS_API_KEY">;

export type NormalizedAddressStatus =
  | "validated"
  | "likely_complete_unverified"
  | "needs_more_detail"
  | "not_found"
  | "validation_unavailable";

export interface NormalizedAddressResult {
  city?: string;
  confidence: number;
  country?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
  latitude?: number;
  longitude?: number;
  missing: string[];
  ok: true;
  placeId?: string;
  postalCode?: string;
  readBack?: string;
  rawAddress: string;
  serviceAddress?: string;
  spokenAddress?: string;
  state?: string;
  stateCode?: string;
  status: NormalizedAddressStatus;
  streetLine?: string;
  unitOrAccess?: string;
  callerGuidance: string;
}

interface NormalizeCustomerAddressInput {
  context?: RestaurantVoiceContext;
  env: AddressEnv;
  fetchImpl?: typeof fetch;
  rawAddress?: string;
  unitOrAccess?: string;
}

interface GooglePlacesTextSearchResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  addressComponents?: GoogleAddressComponent[];
  formattedAddress?: string;
  googleMapsUri?: string;
  id?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  name?: string;
  types?: string[];
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.formattedAddress",
  "places.location",
  "places.addressComponents",
  "places.googleMapsUri",
  "places.types",
].join(",");

export async function normalizeCustomerAddress({
  context,
  env,
  fetchImpl = fetch,
  rawAddress,
  unitOrAccess,
}: NormalizeCustomerAddressInput): Promise<NormalizedAddressResult> {
  const address = compactAddress(rawAddress);
  const unit = compactAddress(unitOrAccess);
  if (!address) {
    return buildNeedsMoreDetailResult({
      callerGuidance: "Ask for the street address first. Do not ask for name, phone, timing, and address all at once.",
      missing: ["street_address"],
      rawAddress: "",
      unitOrAccess: unit,
    });
  }

  const key = env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return buildUnverifiedAddressResult(address, unit);
  }

  try {
    const place = await fetchBestGooglePlace({
      address,
      context,
      fetchImpl,
      key,
    });
    if (!place) {
      const heuristic = assessRawAddress(address);
      return {
        confidence: heuristic.confidence,
        missing: heuristic.missing,
        ok: true,
        rawAddress: address,
        status: heuristic.missing.length ? "needs_more_detail" : "not_found",
        unitOrAccess: unit,
        callerGuidance: heuristic.missing.length
          ? `Google could not validate this yet. Ask only for the missing address detail${heuristic.missing.length === 1 ? "" : "s"}: ${formatMissingFields(heuristic.missing)}.`
          : "Google did not find a confident match. Read the address back as unverified and ask the caller to confirm or spell the city/state.",
      };
    }

    return buildGooglePlaceResult(place, address, unit);
  } catch (error) {
    const fallback = buildUnverifiedAddressResult(address, unit);
    return {
      ...fallback,
      status: fallback.status === "likely_complete_unverified" ? "validation_unavailable" : fallback.status,
      callerGuidance:
        `Google address validation is temporarily unavailable. ${fallback.callerGuidance}`,
    };
  }
}

async function fetchBestGooglePlace({
  address,
  context,
  fetchImpl,
  key,
}: {
  address: string;
  context?: RestaurantVoiceContext;
  fetchImpl: typeof fetch;
  key: string;
}) {
  const locationHint = buildLocationHint(context?.policies.location);
  const query = locationHint ? `${address} ${locationHint}`.trim() : address;
  const response = await fetchImpl(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    body: JSON.stringify({
      languageCode: "en",
      regionCode: "US",
      textQuery: query,
    }),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Places address lookup failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as GooglePlacesTextSearchResponse;
  return data.places?.find((place) => place.formattedAddress?.trim());
}

function buildGooglePlaceResult(place: GooglePlace, rawAddress: string, unitOrAccess?: string): NormalizedAddressResult {
  const components = mapAddressComponents(place.addressComponents ?? []);
  const missing = missingAddressFields(components, rawAddress);
  const streetLine = buildStreetLine(components) ?? firstAddressSegment(place.formattedAddress);
  const formattedAddress = withUnit(place.formattedAddress, unitOrAccess);
  const spokenAddress = buildSpokenAddress({
    city: components.city,
    formattedAddress,
    state: components.state,
    streetLine: withUnit(streetLine, unitOrAccess),
  });
  const status: NormalizedAddressStatus = missing.length ? "needs_more_detail" : "validated";

  return {
    city: components.city,
    confidence: status === "validated" ? 94 : 68,
    country: components.country,
    formattedAddress,
    googleMapsUri: place.googleMapsUri,
    latitude: numberOrUndefined(place.location?.latitude),
    longitude: numberOrUndefined(place.location?.longitude),
    missing,
    ok: true,
    placeId: place.id ?? place.name?.replace(/^places\//, ""),
    postalCode: components.postalCode,
    rawAddress,
    readBack: status === "validated" && spokenAddress ? `I've got ${spokenAddress}. Is that right?` : undefined,
    serviceAddress: formattedAddress,
    spokenAddress,
    state: components.state,
    stateCode: components.stateCode,
    status,
    streetLine: withUnit(streetLine, unitOrAccess),
    unitOrAccess,
    callerGuidance: status === "validated"
      ? `Read back exactly: "I've got ${spokenAddress}. Is that right?" After the caller confirms, include the formatted address in the request details and any text or email confirmation.`
      : `Google found a possible match, but it is missing: ${formatMissingFields(missing)}. Ask only for those missing pieces before saving the request.`,
  };
}

function buildUnverifiedAddressResult(rawAddress: string, unitOrAccess?: string): NormalizedAddressResult {
  const heuristic = assessRawAddress(rawAddress);
  const serviceAddress = withUnit(rawAddress, unitOrAccess);
  const spokenAddress = humanizeAddressForSpeech(serviceAddress);
  if (heuristic.missing.length) {
    return buildNeedsMoreDetailResult({
      callerGuidance: `Ask only for the missing address detail${heuristic.missing.length === 1 ? "" : "s"}: ${formatMissingFields(heuristic.missing)}.`,
      missing: heuristic.missing,
      rawAddress,
      unitOrAccess,
    });
  }

  return {
    confidence: heuristic.confidence,
    formattedAddress: serviceAddress,
    missing: [],
    ok: true,
    rawAddress,
    readBack: `I've got ${spokenAddress}. Is that right?`,
    serviceAddress,
    spokenAddress,
    status: "likely_complete_unverified",
    unitOrAccess,
    callerGuidance:
      `Google address validation is not configured, so read back exactly: "I've got ${spokenAddress}. Is that right?" After the caller confirms, include this address in the request details and any text or email confirmation.`,
  };
}

function buildNeedsMoreDetailResult({
  callerGuidance,
  missing,
  rawAddress,
  unitOrAccess,
}: {
  callerGuidance: string;
  missing: string[];
  rawAddress: string;
  unitOrAccess?: string;
}): NormalizedAddressResult {
  return {
    confidence: 35,
    missing,
    ok: true,
    rawAddress,
    status: "needs_more_detail",
    unitOrAccess,
    callerGuidance,
  };
}

function mapAddressComponents(components: GoogleAddressComponent[]) {
  const byType = (type: string) => components.find((component) => component.types?.includes(type));
  return {
    city: textOf(byType("locality")) ?? textOf(byType("postal_town")) ?? textOf(byType("sublocality")),
    country: textOf(byType("country")),
    postalCode: textOf(byType("postal_code")),
    route: textOf(byType("route")),
    state: textOf(byType("administrative_area_level_1")),
    stateCode: byType("administrative_area_level_1")?.shortText,
    streetNumber: textOf(byType("street_number")),
  };
}

function textOf(component?: GoogleAddressComponent) {
  return component?.longText?.trim() || component?.shortText?.trim() || undefined;
}

function missingAddressFields(components: ReturnType<typeof mapAddressComponents>, rawAddress: string) {
  const heuristic = assessRawAddress(rawAddress);
  const missing = [
    !components.streetNumber && !heuristic.hasStreetNumber && "street_number",
    !components.route && !heuristic.hasStreetName && "street_name",
    !components.city && !heuristic.hasCityOrState && "city",
    !components.state && !heuristic.hasState && "state",
  ].filter((field): field is string => Boolean(field));
  return missing;
}

function assessRawAddress(rawAddress: string) {
  const hasStreetNumber = /\b\d{1,6}[a-z]?\b/i.test(rawAddress);
  const hasStreetName =
    /\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|circle|cir|boulevard|blvd|way|place|pl|terrace|ter|trail|trl|parkway|pkwy|highway|hwy|route|square|sq)\b/i.test(
      rawAddress,
    );
  const hasState = hasStateToken(rawAddress);
  const hasCityOrState = hasState || /,\s*[a-z][a-z\s.-]{2,}/i.test(rawAddress);
  const missing = [
    !hasStreetNumber && "street_number",
    !hasStreetName && "street_name",
    !hasCityOrState && "city_or_state",
  ].filter((field): field is string => Boolean(field));

  return {
    confidence: missing.length ? 38 : 72,
    hasCityOrState,
    hasState,
    hasStreetName,
    hasStreetNumber,
    missing,
  };
}

function hasStateToken(rawAddress: string) {
  return US_STATE_NAME_PATTERN.test(rawAddress) || US_STATE_ABBREVIATION_PATTERN.test(rawAddress);
}

const US_STATE_NAME_PATTERN =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;

const US_STATE_ABBREVIATION_PATTERN =
  /,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/i;

function buildStreetLine(components: ReturnType<typeof mapAddressComponents>) {
  return [components.streetNumber, components.route].filter(Boolean).join(" ") || undefined;
}

function firstAddressSegment(value?: string) {
  return value?.split(",")[0]?.trim() || undefined;
}

function buildLocationHint(address?: string) {
  const parts = address?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  if (parts.length >= 3) return parts.slice(1).join(", ");
  if (parts.length === 2) return parts.join(", ");
  return undefined;
}

function withUnit(address?: string, unitOrAccess?: string) {
  const compact = compactAddress(address);
  const unit = compactAddress(unitOrAccess);
  if (!compact) return unit;
  if (!unit || compact.toLowerCase().includes(unit.toLowerCase())) return compact;
  if (/^(apt|apartment|unit|suite|ste|#|floor|fl)\b/i.test(unit)) {
    return insertUnit(compact, unit);
  }
  return compact;
}

function insertUnit(address: string, unit: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return `${address} ${unit}`.trim();
  parts[0] = `${parts[0]} ${unit}`;
  return parts.join(", ");
}

function buildSpokenAddress({
  city,
  formattedAddress,
  state,
  streetLine,
}: {
  city?: string;
  formattedAddress?: string;
  state?: string;
  streetLine?: string;
}) {
  if (streetLine && city && state) return humanizeAddressForSpeech(`${streetLine} in ${city}, ${state}`);
  return humanizeAddressForSpeech(formattedAddress);
}

function humanizeAddressForSpeech(value?: string) {
  return value
    ?.replace(/,\s*(USA|United States)$/i, "")
    .replace(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAddress(value?: string) {
  return value?.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim() || undefined;
}

function formatMissingFields(fields: string[]) {
  return fields.map((field) => field.replace(/_/g, " ")).join(", ");
}

function numberOrUndefined(value?: number) {
  return Number.isFinite(value) ? value : undefined;
}
