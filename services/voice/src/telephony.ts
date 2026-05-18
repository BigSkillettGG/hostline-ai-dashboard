import type { VoiceServiceEnv } from "./env";
import { buildOpenAIRealtimeLiveCallConfig } from "./openai-realtime-sip";

export interface AvailableTwilioNumber {
  capabilities: Record<string, boolean>;
  friendlyName?: string;
  locality?: string;
  phoneNumber: string;
  region?: string;
}

export interface ProvisionPhoneNumberInput {
  forwardingMode?: string;
  locationId?: string;
  makePrimary?: boolean;
  phoneNumber: string;
  restaurantMainLine?: string;
  trialDays?: number;
  trialGraceDays?: number;
}

export interface ReleasePhoneNumberInput {
  providerSid: string;
}

export interface ProvisionedPhoneNumber {
  capabilities: Record<string, boolean>;
  phoneNumber: string;
  providerSid: string;
  routingMode?: "openai_realtime_sip" | "twilio_voice_webhook";
  status: string;
  voiceWebhookUrl?: string;
}

export interface ReleasedPhoneNumber {
  providerSid: string;
  status: "released";
}

export interface TelephonyService {
  configured: boolean;
  findIncomingPhoneNumber(input: { phoneNumber: string }): Promise<ProvisionedPhoneNumber | undefined>;
  searchAvailableNumbers(input: {
    areaCode?: string;
    contains?: string;
    country?: string;
    limit?: number;
  }): Promise<AvailableTwilioNumber[]>;
  provisionPhoneNumber(input: ProvisionPhoneNumberInput): Promise<ProvisionedPhoneNumber>;
  releasePhoneNumber(input: ReleasePhoneNumberInput): Promise<ReleasedPhoneNumber>;
}

interface TwilioAvailableNumberResponse {
  available_phone_numbers?: Array<{
    capabilities?: Record<string, boolean>;
    friendly_name?: string;
    locality?: string;
    phone_number?: string;
    region?: string;
  }>;
}

interface TwilioIncomingPhoneNumberResponse {
  capabilities?: Record<string, boolean>;
  phone_number?: string;
  sid?: string;
  status?: string;
  voice_url?: string;
}

export function createTelephonyService(env: VoiceServiceEnv): TelephonyService {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    return new TwilioTelephonyService(env);
  }

  return new NotConfiguredTelephonyService();
}

export function buildVoiceWebhookUrl(env: Pick<VoiceServiceEnv, "PUBLIC_HTTP_BASE_URL">, locationId?: string) {
  const baseUrl = env.PUBLIC_HTTP_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return undefined;
  const url = new URL(`${baseUrl}/twilio/voice`);
  if (locationId) url.searchParams.set("locationId", locationId);
  return url.toString();
}

export function mapTwilioAvailableNumbers(response: TwilioAvailableNumberResponse): AvailableTwilioNumber[] {
  return (response.available_phone_numbers ?? [])
    .filter((number) => Boolean(number.phone_number))
    .map((number) => ({
      capabilities: number.capabilities ?? {},
      friendlyName: number.friendly_name,
      locality: number.locality,
      phoneNumber: number.phone_number ?? "",
      region: number.region,
    }));
}

class NotConfiguredTelephonyService implements TelephonyService {
  configured = false;

  async findIncomingPhoneNumber(): Promise<ProvisionedPhoneNumber | undefined> {
    throw new Error("Twilio provisioning is not configured.");
  }

  async searchAvailableNumbers(): Promise<AvailableTwilioNumber[]> {
    throw new Error("Twilio provisioning is not configured.");
  }

  async provisionPhoneNumber(): Promise<ProvisionedPhoneNumber> {
    throw new Error("Twilio provisioning is not configured.");
  }

  async releasePhoneNumber(): Promise<ReleasedPhoneNumber> {
    throw new Error("Twilio provisioning is not configured.");
  }
}

class TwilioTelephonyService implements TelephonyService {
  configured = true;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly baseUrl: string;
  private readonly defaultCountry: string;
  private readonly env: VoiceServiceEnv;
  private readonly sipTrunkSid?: string;
  private readonly trunkingBaseUrl: string;

  constructor(env: VoiceServiceEnv) {
    this.accountSid = env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = env.TWILIO_AUTH_TOKEN ?? "";
    this.baseUrl = env.TWILIO_API_BASE_URL.replace(/\/$/, "");
    this.defaultCountry = env.TWILIO_DEFAULT_COUNTRY;
    this.env = env;
    this.sipTrunkSid = env.TWILIO_SIP_TRUNK_SID?.trim();
    this.trunkingBaseUrl = (env.TWILIO_TRUNKING_API_BASE_URL ?? "https://trunking.twilio.com").replace(/\/$/, "");
  }

  async searchAvailableNumbers(input: {
    areaCode?: string;
    contains?: string;
    country?: string;
    limit?: number;
  }) {
    const country = encodeURIComponent((input.country || this.defaultCountry).toUpperCase());
    const params = new URLSearchParams({
      PageSize: String(clampLimit(input.limit ?? 5)),
      SmsEnabled: "true",
      VoiceEnabled: "true",
    });
    if (input.areaCode) params.set("AreaCode", input.areaCode);
    if (input.contains) params.set("Contains", input.contains);

    const response = await this.twilioRequest<TwilioAvailableNumberResponse>(
      `/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/AvailablePhoneNumbers/${country}/Local.json?${params.toString()}`,
    );

    return mapTwilioAvailableNumbers(response);
  }

  async findIncomingPhoneNumber(input: { phoneNumber: string }) {
    const params = new URLSearchParams({
      PageSize: "1",
      PhoneNumber: input.phoneNumber,
    });
    const response = await this.twilioRequest<{ incoming_phone_numbers?: TwilioIncomingPhoneNumberResponse[] }>(
      `/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/IncomingPhoneNumbers.json?${params.toString()}`,
    );
    const number = response.incoming_phone_numbers?.[0];
    if (!number?.phone_number) return undefined;

    return {
      capabilities: number.capabilities ?? {},
      phoneNumber: number.phone_number,
      providerSid: number.sid ?? "",
      routingMode: number.voice_url ? ("twilio_voice_webhook" as const) : undefined,
      status: number.status ?? "active",
      voiceWebhookUrl: number.voice_url,
    };
  }

  async provisionPhoneNumber(input: ProvisionPhoneNumberInput) {
    const voiceWebhookUrl = buildVoiceWebhookUrl(this.env, input.locationId);
    if (!voiceWebhookUrl && !this.sipTrunkSid) {
      throw new Error("PUBLIC_HTTP_BASE_URL or TWILIO_SIP_TRUNK_SID is required before provisioning a Twilio number.");
    }

    const body = new URLSearchParams({
      FriendlyName: `SignalHost ${input.locationId ?? "location"}`,
      PhoneNumber: input.phoneNumber,
    });
    if (!this.sipTrunkSid && voiceWebhookUrl) {
      body.set("VoiceMethod", "POST");
      body.set("VoiceUrl", voiceWebhookUrl);
    }

    const response = await this.twilioRequest<TwilioIncomingPhoneNumberResponse>(
      `/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/IncomingPhoneNumbers.json`,
      {
        body,
        method: "POST",
      },
    );
    const providerSid = response.sid ?? "";
    let routingMode: ProvisionedPhoneNumber["routingMode"] = "twilio_voice_webhook";
    let resolvedVoiceWebhookUrl = response.voice_url ?? voiceWebhookUrl;
    if (this.sipTrunkSid) {
      if (!providerSid) {
        throw new Error("Twilio did not return a Phone Number SID, so the number cannot be attached to the SIP trunk.");
      }
      try {
        await this.attachNumberToSipTrunk(providerSid);
      } catch (error) {
        await this.releasePhoneNumber({ providerSid }).catch((cleanupError) => {
          console.warn("[telephony] failed to release newly purchased number after SIP trunk attachment failure", {
            cleanupError,
            phoneNumber: input.phoneNumber,
            providerSid,
          });
        });
        throw error;
      }
      routingMode = "openai_realtime_sip";
      resolvedVoiceWebhookUrl = buildOpenAIRealtimeLiveCallConfig(this.env, input.locationId).webhookUrl;
    }

    return {
      capabilities: response.capabilities ?? {},
      phoneNumber: response.phone_number ?? input.phoneNumber,
      providerSid,
      routingMode,
      status: response.status ?? "provisioned",
      voiceWebhookUrl: resolvedVoiceWebhookUrl,
    };
  }

  async releasePhoneNumber(input: ReleasePhoneNumberInput): Promise<ReleasedPhoneNumber> {
    const providerSid = input.providerSid.trim();
    if (!providerSid) {
      throw new Error("providerSid is required to release a Twilio number.");
    }

    await this.twilioRequest<void>(
      `/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/IncomingPhoneNumbers/${encodeURIComponent(providerSid)}.json`,
      { method: "DELETE" },
    );

    return { providerSid, status: "released" };
  }

  private async twilioRequest<T>(path: string, init?: { body?: URLSearchParams; method?: "DELETE" | "GET" | "POST" }) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      body: init?.body,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: init?.method ?? "GET",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Twilio ${init?.method ?? "GET"} failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  private async attachNumberToSipTrunk(phoneNumberSid: string) {
    if (!this.sipTrunkSid) return;
    await this.twilioTrunkingRequest(
      `/v1/Trunks/${encodeURIComponent(this.sipTrunkSid)}/PhoneNumbers`,
      {
        body: new URLSearchParams({
          PhoneNumberSid: phoneNumberSid,
        }),
        method: "POST",
      },
    );
  }

  private async twilioTrunkingRequest<T>(path: string, init?: { body?: URLSearchParams; method?: "DELETE" | "GET" | "POST" }) {
    const response = await fetch(`${this.trunkingBaseUrl}${path}`, {
      body: init?.body,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: init?.method ?? "GET",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Twilio Trunking ${init?.method ?? "GET"} failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}

function clampLimit(limit: number) {
  return Math.max(1, Math.min(20, Math.round(limit)));
}
