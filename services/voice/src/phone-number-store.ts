import type { VoiceServiceEnv } from "./env";
import { buildSupabaseServiceHeaders } from "./supabase-headers";
import type { ProvisionPhoneNumberInput, ProvisionedPhoneNumber } from "./telephony";

export interface TrialPhoneNumberReleaseCandidate {
  id: string;
  locationId: string;
  phoneNumber: string;
  providerSid: string;
  trialGraceEndsAt?: string;
}

export interface LocationProvisioningGuard {
  allowed: boolean;
  existingPhoneNumber?: string;
  existingProviderSid?: string;
  existingStatus?: string;
  locationId: string;
  reason?: "active_number_exists" | "trial_grace_expired";
  trialGraceEndsAt?: string;
}

export interface PhoneNumberStore {
  getLocationProvisioningGuard(locationId?: string, now?: Date): Promise<LocationProvisioningGuard>;
  listExpiredTrialNumbers(input?: { limit?: number; now?: Date }): Promise<TrialPhoneNumberReleaseCandidate[]>;
  markLocationNumberPaid(input: { locationId?: string; reason?: string }): Promise<void>;
  markNumberReleased(input: {
    id?: string;
    locationId?: string;
    phoneNumber?: string;
    providerSid?: string;
    releaseReason?: string;
  }): Promise<void>;
  saveProvisionedNumber(input: ProvisionPhoneNumberInput, provisioned: ProvisionedPhoneNumber): Promise<void>;
}

export function createPhoneNumberStore(env: VoiceServiceEnv): PhoneNumberStore {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID) {
    return new SupabasePhoneNumberStore({
      defaultLocationId: env.SUPABASE_DEMO_LOCATION_ID,
      key: env.SUPABASE_SECRET_KEY,
      url: env.SUPABASE_URL,
    });
  }

  return new NoopPhoneNumberStore();
}

class NoopPhoneNumberStore implements PhoneNumberStore {
  async getLocationProvisioningGuard(locationId?: string): Promise<LocationProvisioningGuard> {
    console.info("[phone-number-store] Supabase not configured; provisioning guard skipped", { locationId });
    return { allowed: true, locationId: locationId ?? "" };
  }

  async listExpiredTrialNumbers(): Promise<TrialPhoneNumberReleaseCandidate[]> {
    console.info("[phone-number-store] Supabase not configured; expired trial numbers not loaded");
    return [];
  }

  async markLocationNumberPaid(input: { locationId?: string; reason?: string }) {
    console.info("[phone-number-store] Supabase not configured; paid phone-number lifecycle not persisted", {
      locationId: input.locationId,
      reason: input.reason,
    });
  }

  async markNumberReleased(input: { phoneNumber?: string; providerSid?: string }) {
    console.info("[phone-number-store] Supabase not configured; released phone number not persisted", {
      phoneNumber: input.phoneNumber,
      providerSid: input.providerSid,
    });
  }

  async saveProvisionedNumber(input: ProvisionPhoneNumberInput, provisioned: ProvisionedPhoneNumber) {
    console.info("[phone-number-store] Supabase not configured; phone number not persisted", {
      locationId: input.locationId,
      phoneNumber: provisioned.phoneNumber,
    });
  }
}

class SupabasePhoneNumberStore implements PhoneNumberStore {
  private readonly defaultLocationId: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor({ defaultLocationId, key, url }: { defaultLocationId: string; key: string; url: string }) {
    this.defaultLocationId = defaultLocationId;
    this.key = key;
    this.restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
  }

  async saveProvisionedNumber(input: ProvisionPhoneNumberInput, provisioned: ProvisionedPhoneNumber) {
    const locationId = normalizeLocationId(input.locationId) ?? this.defaultLocationId;
    const trialStartedAt = new Date();
    const trialEndsAt = addDays(trialStartedAt, inputTrialDays(input));
    const trialGraceEndsAt = addDays(trialEndsAt, inputTrialGraceDays(input));

    const legacyBody = {
      capabilities: provisioned.capabilities,
      forwarding_mode: input.forwardingMode ?? "forward_unanswered",
      forwarding_status: "pending_verification",
      location_id: locationId,
      phone_number: provisioned.phoneNumber,
      provider: "twilio",
      provider_sid: provisioned.providerSid || null,
      restaurant_main_line: input.restaurantMainLine ?? null,
      status: provisioned.status,
      updated_at: new Date().toISOString(),
      voice_webhook_url: provisioned.voiceWebhookUrl ?? null,
    };

    try {
      await this.upsertPhoneNumber({
        ...legacyBody,
        provisioning_source: "trial",
        released_at: null,
        release_reason: null,
        trial_ends_at: trialEndsAt.toISOString(),
        trial_grace_ends_at: trialGraceEndsAt.toISOString(),
        trial_started_at: trialStartedAt.toISOString(),
      });
    } catch (error) {
      if (!isMissingPhoneNumberLifecycleColumnError(error)) throw error;
      console.warn("[phone-number-store] phone number lifecycle columns missing; saved legacy phone row only", {
        locationId,
        phoneNumber: provisioned.phoneNumber,
      });
      await this.upsertPhoneNumber(legacyBody);
    }

    if (input.makePrimary !== false) {
      await this.request("locations", {
        body: {
          ai_host_phone: provisioned.phoneNumber,
          phone: input.restaurantMainLine ?? undefined,
        },
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(locationId)}`,
      });
    }
  }

  private async upsertPhoneNumber(body: Record<string, unknown>) {
    const options = {
      body,
      headers: {
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      method: "POST" as const,
      query: "on_conflict=provider,phone_number",
    };

    try {
      await this.request("phone_numbers", options);
      return;
    } catch (error) {
      if (!isMissingPhoneNumberUpsertConstraintError(error)) throw error;
      console.warn("[phone-number-store] phone number unique upsert constraint missing; inserted phone row without on_conflict", {
        phoneNumber: body.phone_number,
      });
    }

    await this.request("phone_numbers", {
      body,
      headers: {
        Prefer: "return=minimal",
      },
      method: "POST",
    });
  }

  async getLocationProvisioningGuard(locationId?: string, now = new Date()): Promise<LocationProvisioningGuard> {
    const normalizedLocationId = normalizeLocationId(locationId) ?? this.defaultLocationId;
    let rows: Array<{
      id: string;
      phone_number: string;
      provider_sid: string | null;
      status: string | null;
      trial_grace_ends_at: string | null;
    }>;
    try {
      rows = await this.get(
        "phone_numbers",
        [
          `location_id=eq.${encodeURIComponent(normalizedLocationId)}`,
          "released_at=is.null",
          "status=in.(provisioned,trialing,in-use,active)",
          "select=id,phone_number,provider_sid,status,trial_grace_ends_at",
          "order=created_at.desc",
          "limit=1",
        ].join("&"),
      );
    } catch (error) {
      if (!isMissingPhoneNumberLifecycleColumnError(error)) throw error;
      console.warn("[phone-number-store] phone number lifecycle columns missing; using legacy provisioning guard", {
        locationId: normalizedLocationId,
      });
      rows = await this.get<Array<{
        id: string;
        phone_number: string;
        provider_sid: string | null;
        status: string | null;
        trial_grace_ends_at?: null;
      }>>(
        "phone_numbers",
        [
          `location_id=eq.${encodeURIComponent(normalizedLocationId)}`,
          "status=in.(provisioned,trialing,in-use,active)",
          "select=id,phone_number,provider_sid,status",
          "order=created_at.desc",
          "limit=1",
        ].join("&"),
      ).then((legacyRows) => legacyRows.map((row) => ({ ...row, trial_grace_ends_at: null })));
    }
    const existingNumber = rows?.[0];
    if (!existingNumber) {
      return { allowed: true, locationId: normalizedLocationId };
    }

    const trialGraceEndsAt = existingNumber.trial_grace_ends_at ?? undefined;
    const graceEnds = trialGraceEndsAt ? new Date(trialGraceEndsAt) : undefined;
    return {
      allowed: false,
      existingPhoneNumber: existingNumber.phone_number,
      existingProviderSid: existingNumber.provider_sid ?? undefined,
      existingStatus: existingNumber.status ?? undefined,
      locationId: normalizedLocationId,
      reason: graceEnds && !Number.isNaN(graceEnds.getTime()) && now.getTime() > graceEnds.getTime()
        ? "trial_grace_expired"
        : "active_number_exists",
      trialGraceEndsAt,
    };
  }

  async listExpiredTrialNumbers(input: { limit?: number; now?: Date } = {}) {
    const now = input.now ?? new Date();
    const limit = Math.max(1, Math.min(100, Math.round(input.limit ?? 25)));
    const rows = await this.get<Array<{
      id: string;
      location_id: string;
      phone_number: string;
      provider_sid: string | null;
      trial_grace_ends_at: string | null;
    }>>(
      "phone_numbers",
      [
        "provider=eq.twilio",
        "released_at=is.null",
        "status=in.(provisioned,trialing,in-use,active)",
        `trial_grace_ends_at=lte.${encodeURIComponent(now.toISOString())}`,
        "select=id,location_id,phone_number,provider_sid,trial_grace_ends_at",
        "order=trial_grace_ends_at.asc",
        `limit=${limit}`,
      ].join("&"),
    );

    return (rows ?? [])
      .filter((row) => Boolean(row.provider_sid))
      .map((row) => ({
        id: row.id,
        locationId: row.location_id,
        phoneNumber: row.phone_number,
        providerSid: row.provider_sid ?? "",
        trialGraceEndsAt: row.trial_grace_ends_at ?? undefined,
      }));
  }

  async markLocationNumberPaid(input: { locationId?: string; reason?: string }) {
    const normalizedLocationId = normalizeLocationId(input.locationId) ?? this.defaultLocationId;
    const updatedAt = new Date().toISOString();

    await this.request("phone_numbers", {
      body: {
        provisioning_source: "paid",
        release_reason: null,
        status: "active",
        trial_ends_at: null,
        trial_grace_ends_at: null,
        updated_at: updatedAt,
      },
      method: "PATCH",
      query: [
        `location_id=eq.${encodeURIComponent(normalizedLocationId)}`,
        "released_at=is.null",
        "status=in.(provisioned,trialing,in-use,active)",
      ].join("&"),
    });
  }

  async markNumberReleased(input: {
    id?: string;
    locationId?: string;
    phoneNumber?: string;
    providerSid?: string;
    releaseReason?: string;
  }) {
    const releasedAt = new Date().toISOString();
    const filter = input.id
      ? `id=eq.${encodeURIComponent(input.id)}`
      : input.providerSid
        ? `provider_sid=eq.${encodeURIComponent(input.providerSid)}`
        : input.phoneNumber
          ? `phone_number=eq.${encodeURIComponent(input.phoneNumber)}`
          : "";
    if (!filter) return;

    await this.request("phone_numbers", {
      body: {
        forwarding_status: "released",
        release_reason: input.releaseReason ?? "released",
        released_at: releasedAt,
        status: "released",
        updated_at: releasedAt,
      },
      method: "PATCH",
      query: filter,
    });

    if (input.locationId && input.phoneNumber) {
      await this.request("locations", {
        body: {
          ai_host_phone: null,
        },
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(input.locationId)}&ai_host_phone=eq.${encodeURIComponent(input.phoneNumber)}`,
      });
    }
  }

  private async request(
    table: string,
    options: {
      body: unknown;
      headers?: Record<string, string>;
      method: "POST" | "PATCH";
      query?: string;
    },
  ) {
    const query = options.query ? `?${options.query}` : "";
    const response = await fetch(`${this.restUrl}/${table}${query}`, {
      body: JSON.stringify(options.body),
      headers: buildSupabaseServiceHeaders(this.key, options.headers),
      method: options.method,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase ${options.method} ${table} failed: ${response.status} ${body}`);
    }
  }

  private async get<T>(table: string, query: string): Promise<T> {
    const response = await fetch(`${this.restUrl}/${table}?${query}`, {
      headers: buildSupabaseServiceHeaders(this.key),
      method: "GET",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase GET ${table} failed: ${response.status} ${body}`);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function inputTrialDays(input: ProvisionPhoneNumberInput) {
  const value = Number((input as { trialDays?: unknown }).trialDays);
  return Number.isFinite(value) ? Math.max(1, Math.min(30, Math.round(value))) : 7;
}

function inputTrialGraceDays(input: ProvisionPhoneNumberInput) {
  const value = Number((input as { trialGraceDays?: unknown }).trialGraceDays);
  return Number.isFinite(value) ? Math.max(0, Math.min(60, Math.round(value))) : 14;
}

function isMissingPhoneNumberLifecycleColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /provisioning_source|trial_started_at|trial_ends_at|trial_grace_ends_at|released_at|release_reason|sms_webhook_url|column .* does not exist|schema cache|PGRST204|42703/i.test(error.message);
}

function isMissingPhoneNumberUpsertConstraintError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /no unique or exclusion constraint|42P10|on conflict|on_conflict|provider,phone_number/i.test(error.message);
}
