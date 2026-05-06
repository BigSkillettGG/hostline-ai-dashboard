import type { VoiceServiceEnv } from "./env";

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
  phoneNumber: string;
  restaurantMainLine?: string;
}

export interface ProvisionedPhoneNumber {
  capabilities: Record<string, boolean>;
  phoneNumber: string;
  providerSid: string;
  status: string;
  voiceWebhookUrl?: string;
}

export interface TelephonyService {
  configured: boolean;
  searchAvailableNumbers(input: {
    areaCode?: string;
    contains?: string;
    country?: string;
    limit?: number;
  }): Promise<AvailableTwilioNumber[]>;
  provisionPhoneNumber(input: ProvisionPhoneNumberInput): Promise<ProvisionedPhoneNumber>;
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

  async searchAvailableNumbers(): Promise<AvailableTwilioNumber[]> {
    throw new Error("Twilio provisioning is not configured.");
  }

  async provisionPhoneNumber(): Promise<ProvisionedPhoneNumber> {
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

  constructor(env: VoiceServiceEnv) {
    this.accountSid = env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = env.TWILIO_AUTH_TOKEN ?? "";
    this.baseUrl = env.TWILIO_API_BASE_URL.replace(/\/$/, "");
    this.defaultCountry = env.TWILIO_DEFAULT_COUNTRY;
    this.env = env;
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

  async provisionPhoneNumber(input: ProvisionPhoneNumberInput) {
    const voiceWebhookUrl = buildVoiceWebhookUrl(this.env, input.locationId);
    if (!voiceWebhookUrl) {
      throw new Error("PUBLIC_HTTP_BASE_URL is required before provisioning a Twilio number.");
    }

    const body = new URLSearchParams({
      FriendlyName: `HostLine ${input.locationId ?? "location"}`,
      PhoneNumber: input.phoneNumber,
      VoiceMethod: "POST",
      VoiceUrl: voiceWebhookUrl,
    });

    const response = await this.twilioRequest<TwilioIncomingPhoneNumberResponse>(
      `/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/IncomingPhoneNumbers.json`,
      {
        body,
        method: "POST",
      },
    );

    return {
      capabilities: response.capabilities ?? {},
      phoneNumber: response.phone_number ?? input.phoneNumber,
      providerSid: response.sid ?? "",
      status: response.status ?? "provisioned",
      voiceWebhookUrl: response.voice_url ?? voiceWebhookUrl,
    };
  }

  private async twilioRequest<T>(path: string, init?: { body?: URLSearchParams; method?: "GET" | "POST" }) {
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

    return (await response.json()) as T;
  }
}

function clampLimit(limit: number) {
  return Math.max(1, Math.min(20, Math.round(limit)));
}
