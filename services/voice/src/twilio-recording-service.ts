import { createHmac, timingSafeEqual } from "node:crypto";

import type { VoiceServiceEnv } from "./env";

type TwilioRecordingEnv = Pick<
  VoiceServiceEnv,
  | "PUBLIC_HTTP_BASE_URL"
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_API_BASE_URL"
  | "TWILIO_AUTH_TOKEN"
  | "TWILIO_CALL_RECORDING_CHANNELS"
  | "TWILIO_CALL_RECORDING_ENABLED"
  | "TWILIO_CALL_RECORDING_TRACK"
>;

export interface StartCallRecordingInput {
  callRecordId?: string;
  externalCallSid: string;
  locationId?: string;
  openaiCallId?: string;
}

export interface StartCallRecordingResult {
  callbackUrl?: string;
  recordingSid?: string;
  recordingUrl?: string;
  skipped?: boolean;
  started: boolean;
}

export interface FindCallRecordingInput {
  externalCallSid: string;
}

export interface FindCallRecordingResult {
  durationSeconds?: number;
  recordingSid?: string;
  recordingUrl?: string;
  skipped?: boolean;
  status?: string;
}

export interface CallRecordingService {
  callbackUrl?: string;
  configured: boolean;
  findCompletedCallRecording(input: FindCallRecordingInput): Promise<FindCallRecordingResult>;
  startCallRecording(input: StartCallRecordingInput): Promise<StartCallRecordingResult>;
}

interface TwilioRecordingResponse {
  duration?: string;
  media_url?: string;
  sid?: string;
  status?: string;
}

interface TwilioRecordingListResponse {
  recordings?: TwilioRecordingResponse[];
}

export function createTwilioCallRecordingService(
  env: TwilioRecordingEnv,
  fetchImpl: typeof fetch = fetch,
): CallRecordingService {
  if (
    env.TWILIO_CALL_RECORDING_ENABLED === "false" ||
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !env.PUBLIC_HTTP_BASE_URL
  ) {
    return new NotConfiguredCallRecordingService(env);
  }

  return new TwilioCallRecordingService(env, fetchImpl);
}

export function buildTwilioRecordingStatusCallbackUrl(
  env: Pick<TwilioRecordingEnv, "PUBLIC_HTTP_BASE_URL">,
  params: StartCallRecordingInput = { externalCallSid: "" },
) {
  const baseUrl = env.PUBLIC_HTTP_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return undefined;

  const url = new URL(`${baseUrl}/twilio/recording-status`);
  if (params.locationId) url.searchParams.set("locationId", params.locationId);
  if (params.callRecordId) url.searchParams.set("callRecordId", params.callRecordId);
  if (params.externalCallSid) url.searchParams.set("externalCallSid", params.externalCallSid);
  if (params.openaiCallId) url.searchParams.set("openaiCallId", params.openaiCallId);
  return url.toString();
}

export function isTwilioCallSid(value?: string) {
  return /^CA[a-f0-9]{32}$/i.test(value?.trim() ?? "");
}

export function buildTwilioRecordingMediaUrl({
  accountSid,
  baseUrl,
  recordingSid,
}: {
  accountSid: string;
  baseUrl: string;
  recordingSid?: string;
}) {
  if (!recordingSid) return undefined;
  return `${baseUrl.replace(/\/$/, "")}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Recordings/${encodeURIComponent(recordingSid)}.mp3`;
}

export function buildSignalHostRecordingPlaybackUrl({
  publicHttpBaseUrl,
  recordingSid,
  signingSecret,
}: {
  publicHttpBaseUrl?: string;
  recordingSid?: string;
  signingSecret?: string;
}) {
  if (!publicHttpBaseUrl || !recordingSid || !signingSecret) return undefined;
  const token = signRecordingPlaybackToken({ recordingSid, signingSecret });
  return `${publicHttpBaseUrl.replace(/\/$/, "")}/twilio/recordings/${encodeURIComponent(recordingSid)}.mp3?token=${encodeURIComponent(token)}`;
}

export function validateRecordingPlaybackToken({
  expectedToken,
  recordingSid,
  signingSecret,
}: {
  expectedToken?: string | null;
  recordingSid: string;
  signingSecret?: string;
}) {
  if (!expectedToken || !signingSecret) return false;
  const computed = signRecordingPlaybackToken({ recordingSid, signingSecret });
  const expectedBuffer = Buffer.from(expectedToken);
  const computedBuffer = Buffer.from(computed);
  return expectedBuffer.length === computedBuffer.length && timingSafeEqual(expectedBuffer, computedBuffer);
}

class NotConfiguredCallRecordingService implements CallRecordingService {
  callbackUrl?: string;
  configured = false;

  constructor(env: Pick<TwilioRecordingEnv, "PUBLIC_HTTP_BASE_URL">) {
    this.callbackUrl = buildTwilioRecordingStatusCallbackUrl(env);
  }

  async startCallRecording(): Promise<StartCallRecordingResult> {
    return { callbackUrl: this.callbackUrl, skipped: true, started: false };
  }

  async findCompletedCallRecording(): Promise<FindCallRecordingResult> {
    return { skipped: true };
  }
}

class TwilioCallRecordingService implements CallRecordingService {
  callbackUrl?: string;
  configured = true;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly baseUrl: string;
  private readonly channels: "mono" | "dual";
  private readonly fetchImpl: typeof fetch;
  private readonly recordingTrack: "inbound" | "outbound" | "both";
  private readonly startedCallSids = new Set<string>();

  constructor(private readonly env: TwilioRecordingEnv, fetchImpl: typeof fetch) {
    this.accountSid = env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = env.TWILIO_AUTH_TOKEN ?? "";
    this.baseUrl = env.TWILIO_API_BASE_URL.replace(/\/$/, "");
    this.callbackUrl = buildTwilioRecordingStatusCallbackUrl(env);
    this.channels = env.TWILIO_CALL_RECORDING_CHANNELS ?? "dual";
    this.fetchImpl = fetchImpl;
    this.recordingTrack = env.TWILIO_CALL_RECORDING_TRACK ?? "both";
  }

  async startCallRecording(input: StartCallRecordingInput): Promise<StartCallRecordingResult> {
    const externalCallSid = input.externalCallSid.trim();
    if (!isTwilioCallSid(externalCallSid)) {
      return { callbackUrl: this.callbackUrl, skipped: true, started: false };
    }

    if (this.startedCallSids.has(externalCallSid)) {
      return { callbackUrl: this.callbackUrl, skipped: true, started: false };
    }
    this.startedCallSids.add(externalCallSid);

    const callbackUrl = buildTwilioRecordingStatusCallbackUrl(this.env, {
      ...input,
      externalCallSid,
    });
    if (!callbackUrl) {
      return { callbackUrl, skipped: true, started: false };
    }

    const body = new URLSearchParams({
      RecordingChannels: this.channels,
      RecordingStatusCallback: callbackUrl,
      RecordingStatusCallbackEvent: "completed absent",
      RecordingStatusCallbackMethod: "POST",
      RecordingTrack: this.recordingTrack,
    });

    const response = await this.fetchImpl(
      `${this.baseUrl}/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Calls/${encodeURIComponent(externalCallSid)}/Recordings.json`,
      {
        body,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      this.startedCallSids.delete(externalCallSid);
      throw new Error(`Twilio call recording failed: ${response.status} ${text}`);
    }

    const text = await response.text();
    const parsed = text ? JSON.parse(text) as TwilioRecordingResponse : {};
    return {
      callbackUrl,
      recordingSid: parsed.sid,
      recordingUrl: this.buildRecordingPlaybackUrl(parsed.sid),
      started: true,
    };
  }

  async findCompletedCallRecording(input: FindCallRecordingInput): Promise<FindCallRecordingResult> {
    const externalCallSid = input.externalCallSid.trim();
    if (!isTwilioCallSid(externalCallSid)) {
      return { skipped: true };
    }

    const response = await this.fetchImpl(
      `${this.baseUrl}/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Calls/${encodeURIComponent(externalCallSid)}/Recordings.json?PageSize=20`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        },
        method: "GET",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twilio call recording lookup failed: ${response.status} ${text}`);
    }

    const text = await response.text();
    const parsed = text ? JSON.parse(text) as TwilioRecordingListResponse : {};
    const recordings = parsed.recordings ?? [];
    const completed = recordings.find((recording) => recording.sid && normalizeRecordingStatus(recording.status) === "completed");
    const fallback = recordings.find((recording) => recording.sid);
    const match = completed ?? fallback;
    if (!match?.sid) {
      return {};
    }

    return {
      durationSeconds: parseRecordingDurationSeconds(match.duration),
      recordingSid: match.sid,
      recordingUrl: this.buildRecordingPlaybackUrl(match.sid) ?? normalizeTwilioMediaUrl(match.media_url),
      status: match.status,
    };
  }

  private buildRecordingPlaybackUrl(recordingSid?: string) {
    return buildSignalHostRecordingPlaybackUrl({
      publicHttpBaseUrl: this.env.PUBLIC_HTTP_BASE_URL,
      recordingSid,
      signingSecret: this.env.TWILIO_AUTH_TOKEN,
    }) ?? buildTwilioRecordingMediaUrl({
      accountSid: this.accountSid,
      baseUrl: this.baseUrl,
      recordingSid,
    });
  }
}

function signRecordingPlaybackToken({
  recordingSid,
  signingSecret,
}: {
  recordingSid: string;
  signingSecret: string;
}) {
  return createHmac("sha256", signingSecret).update(recordingSid, "utf8").digest("base64url");
}

function normalizeRecordingStatus(value?: string) {
  return value?.trim().toLowerCase();
}

function parseRecordingDurationSeconds(value?: string) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTwilioMediaUrl(value?: string) {
  if (!value?.trim()) return undefined;
  const secure = value.trim().replace(/^http:\/\//i, "https://");
  return /\.(?:mp3|wav)$/i.test(secure) ? secure : `${secure}.mp3`;
}
