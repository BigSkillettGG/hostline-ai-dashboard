import { describe, expect, it, vi } from "vitest";
import {
  buildSignalHostRecordingPlaybackUrl,
  buildTwilioRecordingMediaUrl,
  buildTwilioRecordingStatusCallbackUrl,
  createTwilioCallRecordingService,
  isTwilioCallSid,
  validateRecordingPlaybackToken,
} from "./twilio-recording-service";

describe("Twilio call recording service", () => {
  it("builds the recording callback URL with call identifiers", () => {
    expect(
      buildTwilioRecordingStatusCallbackUrl(
        { PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai/" },
        {
          callRecordId: "call_uuid",
          externalCallSid: "CA1234567890abcdef1234567890abcdef",
          locationId: "loc_123",
          openaiCallId: "rtc_123",
        },
      ),
    ).toBe(
      "https://voice.signalhost.ai/twilio/recording-status?locationId=loc_123&callRecordId=call_uuid&externalCallSid=CA1234567890abcdef1234567890abcdef&openaiCallId=rtc_123",
    );
  });

  it("recognizes Twilio call SIDs before trying the recording API", () => {
    expect(isTwilioCallSid("CA1234567890abcdef1234567890abcdef")).toBe(true);
    expect(isTwilioCallSid("rtc_123")).toBe(false);
  });

  it("builds a Twilio recording media URL from a recording sid", () => {
    expect(
      buildTwilioRecordingMediaUrl({
        accountSid: "AC123",
        baseUrl: "https://api.twilio.com/",
        recordingSid: "RE123",
      }),
    ).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123.mp3");
  });

  it("builds and validates a signed SignalHost recording playback URL", () => {
    const url = buildSignalHostRecordingPlaybackUrl({
      publicHttpBaseUrl: "https://voice.signalhost.ai/",
      recordingSid: "RE123",
      signingSecret: "secret",
    });

    expect(url).toMatch(/^https:\/\/voice\.signalhost\.ai\/twilio\/recordings\/RE123\.mp3\?token=.+/);
    const token = new URL(url ?? "").searchParams.get("token");
    expect(validateRecordingPlaybackToken({
      expectedToken: token,
      recordingSid: "RE123",
      signingSecret: "secret",
    })).toBe(true);
    expect(validateRecordingPlaybackToken({
      expectedToken: token,
      recordingSid: "RE456",
      signingSecret: "secret",
    })).toBe(false);
  });

  it("starts a live Twilio call recording with status callback metadata", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: "RE123" }), { status: 201 }));
    const service = createTwilioCallRecordingService(
      {
        PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_API_BASE_URL: "https://api.twilio.com",
        TWILIO_AUTH_TOKEN: "secret",
      },
      fetchMock as unknown as typeof fetch,
    );

    const result = await service.startCallRecording({
      callRecordId: "call_uuid",
      externalCallSid: "CA1234567890abcdef1234567890abcdef",
      locationId: "loc_123",
      openaiCallId: "rtc_123",
    });

    expect(result).toMatchObject({
      recordingSid: "RE123",
      started: true,
    });
    expect(result.recordingUrl).toMatch(/^https:\/\/voice\.signalhost\.ai\/twilio\/recordings\/RE123\.mp3\?token=.+/);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Calls/CA1234567890abcdef1234567890abcdef/Recordings.json",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(body.get("RecordingStatusCallback")).toBe(
      "https://voice.signalhost.ai/twilio/recording-status?locationId=loc_123&callRecordId=call_uuid&externalCallSid=CA1234567890abcdef1234567890abcdef&openaiCallId=rtc_123",
    );
    expect(body.get("RecordingStatusCallbackEvent")).toBe("completed absent");
    expect(body.get("RecordingChannels")).toBe("dual");
    expect(body.get("RecordingTrack")).toBe("both");
  });

  it("does not start duplicate recordings for the same call sid", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: "RE123" }), { status: 201 }));
    const service = createTwilioCallRecordingService(
      {
        PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_API_BASE_URL: "https://api.twilio.com",
        TWILIO_AUTH_TOKEN: "secret",
      },
      fetchMock as unknown as typeof fetch,
    );

    await service.startCallRecording({ externalCallSid: "CA1234567890abcdef1234567890abcdef" });
    const second = await service.startCallRecording({ externalCallSid: "CA1234567890abcdef1234567890abcdef" });

    expect(second).toMatchObject({ skipped: true, started: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("finds a completed recording for a Twilio call sid", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        recordings: [
          {
            duration: "31",
            media_url: "http://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123",
            sid: "RE123",
            status: "completed",
          },
        ],
      }), { status: 200 })
    );
    const service = createTwilioCallRecordingService(
      {
        PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_API_BASE_URL: "https://api.twilio.com",
        TWILIO_AUTH_TOKEN: "secret",
      },
      fetchMock as unknown as typeof fetch,
    );

    await expect(service.findCompletedCallRecording({
      externalCallSid: "CA1234567890abcdef1234567890abcdef",
    })).resolves.toMatchObject({
      durationSeconds: 31,
      recordingSid: "RE123",
      status: "completed",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Calls/CA1234567890abcdef1234567890abcdef/Recordings.json?PageSize=20",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
