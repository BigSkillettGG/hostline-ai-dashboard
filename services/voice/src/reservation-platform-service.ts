import type { VoiceServiceEnv } from "./env";
import type { RestaurantVoiceContext } from "./restaurant-context";

export type ReservationPlatformProvider = "manual_request" | "opentable";
export type ReservationPlatformStatus = "confirmed" | "pending_staff_confirmation" | "unavailable";

export interface ReservationPlatformRequest {
  callId?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  date: string;
  guestName: string;
  locationId?: string;
  notes?: string;
  partySize: number;
  time: string;
}

export interface ReservationPlatformResult {
  confirmationCode?: string;
  message: string;
  ok: boolean;
  provider: ReservationPlatformProvider;
  providerReservationId?: string;
  raw?: unknown;
  status: ReservationPlatformStatus;
}

export interface ReservationPlatformService {
  configured: boolean;
  provider: ReservationPlatformProvider;
  createReservation(input: ReservationPlatformRequest): Promise<ReservationPlatformResult>;
}

type ReservationPlatformEnv = Pick<
  VoiceServiceEnv,
  | "OPENTABLE_AUTH_URL"
  | "OPENTABLE_CLIENT_ID"
  | "OPENTABLE_CLIENT_SECRET"
  | "OPENTABLE_RESERVATIONS_URL"
  | "OPENTABLE_RESTAURANT_ID"
>;

export function createReservationPlatformService(
  env: ReservationPlatformEnv,
  fetchImpl: typeof fetch = fetch,
): ReservationPlatformService {
  if (
    env.OPENTABLE_CLIENT_ID &&
    env.OPENTABLE_CLIENT_SECRET &&
    env.OPENTABLE_RESTAURANT_ID &&
    env.OPENTABLE_RESERVATIONS_URL
  ) {
    return new OpenTableReservationPlatformService(env, fetchImpl);
  }

  return new ManualReservationPlatformService();
}

class ManualReservationPlatformService implements ReservationPlatformService {
  configured = false;
  provider: ReservationPlatformProvider = "manual_request";

  async createReservation(): Promise<ReservationPlatformResult> {
    return {
      ok: true,
      message:
        "Reservation request saved for staff confirmation. Do not guarantee the table until staff confirms.",
      provider: "manual_request",
      status: "pending_staff_confirmation",
    };
  }
}

class OpenTableReservationPlatformService implements ReservationPlatformService {
  configured = true;
  provider: ReservationPlatformProvider = "opentable";
  private accessToken?: { expiresAt: number; value: string };

  constructor(
    private readonly env: ReservationPlatformEnv,
    private readonly fetchImpl: typeof fetch,
  ) {}

  async createReservation(input: ReservationPlatformRequest): Promise<ReservationPlatformResult> {
    const url = this.env.OPENTABLE_RESERVATIONS_URL;
    if (!url || !this.env.OPENTABLE_RESTAURANT_ID) {
      return {
        ok: false,
        message: "OpenTable reservation endpoint is not configured.",
        provider: "opentable",
        status: "pending_staff_confirmation",
      };
    }

    const response = await this.fetchImpl(url, {
      body: JSON.stringify(buildOpenTableReservationPayload(input, this.env.OPENTABLE_RESTAURANT_ID)),
      headers: await this.buildHeaders(),
      method: "POST",
    });

    const raw = await readJsonSafely(response);
    if (!response.ok) {
      return {
        ok: false,
        message: openTableErrorMessage(response.status, raw),
        provider: "opentable",
        raw,
        status: response.status === 409 ? "unavailable" : "pending_staff_confirmation",
      };
    }

    const providerReservationId = stringFromRecord(raw, [
      "id",
      "reservation_id",
      "reservationId",
      "booking_id",
      "bookingId",
    ]);
    const confirmationCode = stringFromRecord(raw, ["confirmation_code", "confirmationCode", "confirmation"]);

    return {
      confirmationCode,
      message:
        "Reservation confirmed through OpenTable. Tell the caller it is confirmed and offer to text the confirmation.",
      ok: true,
      provider: "opentable",
      providerReservationId,
      raw,
      status: "confirmed",
    };
  }

  private async buildHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-OpenTable-Restaurant-Id": this.env.OPENTABLE_RESTAURANT_ID ?? "",
    };

    const token = await this.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      return headers;
    }

    headers.Authorization = `Basic ${Buffer.from(
      `${this.env.OPENTABLE_CLIENT_ID ?? ""}:${this.env.OPENTABLE_CLIENT_SECRET ?? ""}`,
    ).toString("base64")}`;
    return headers;
  }

  private async getAccessToken() {
    if (!this.env.OPENTABLE_AUTH_URL) return undefined;
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000) return this.accessToken.value;

    const body = new URLSearchParams({
      client_id: this.env.OPENTABLE_CLIENT_ID ?? "",
      client_secret: this.env.OPENTABLE_CLIENT_SECRET ?? "",
      grant_type: "client_credentials",
    });
    const response = await this.fetchImpl(this.env.OPENTABLE_AUTH_URL, {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const raw = await readJsonSafely(response);
    if (!response.ok) throw new Error(openTableErrorMessage(response.status, raw));

    const token = stringFromRecord(raw, ["access_token", "accessToken"]);
    if (!token) throw new Error("OpenTable auth response did not include an access token.");
    const expiresInSeconds = numberFromRecord(raw, ["expires_in", "expiresIn"]) ?? 1800;
    this.accessToken = {
      expiresAt: Date.now() + expiresInSeconds * 1000,
      value: token,
    };
    return token;
  }
}

function buildOpenTableReservationPayload(input: ReservationPlatformRequest, restaurantId: string) {
  return {
    date: input.date,
    external_reference: input.callId,
    guest: {
      name: input.guestName,
      phone: input.callerPhone,
    },
    location_id: input.locationId,
    notes: input.notes,
    party_size: input.partySize,
    restaurant_id: restaurantId,
    source: "hostline_ai",
    time: input.time,
    venue_name: input.context.restaurantName,
  };
}

async function readJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function openTableErrorMessage(status: number, raw: unknown) {
  const message = typeof raw === "object" && raw ? stringFromRecord(raw, ["message", "error", "detail"]) : undefined;
  return `OpenTable reservation request failed: ${status}${message ? ` ${message}` : ""}`;
}

function stringFromRecord(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number") return String(item);
  }
  return undefined;
}

function numberFromRecord(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const item = record[key];
    if (typeof item === "number") return item;
    if (typeof item === "string" && item.trim() && !Number.isNaN(Number(item))) return Number(item);
  }
  return undefined;
}
