import type { VoiceServiceEnv } from "./env";
import { buildSupabaseServiceHeaders } from "./supabase-headers";
import type { ProvisionPhoneNumberInput, ProvisionedPhoneNumber } from "./telephony";

export interface PhoneNumberStore {
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

    await this.request("phone_numbers", {
      body: {
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
      },
      headers: {
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      method: "POST",
      query: "on_conflict=provider,phone_number",
    });

    await this.request("locations", {
      body: {
        ai_host_phone: provisioned.phoneNumber,
        phone: input.restaurantMainLine ?? undefined,
      },
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(locationId)}`,
    });
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
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}
