import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getRequestIp,
  HttpRequestError,
  parseJsonRequestBody,
  readLimitedRequestBody,
  resetRateLimitBucketsForTests,
} from "./http-safety";

describe("http safety helpers", () => {
  it("limits request body size", async () => {
    const req = Readable.from(["hello world"]) as Parameters<typeof readLimitedRequestBody>[0];

    await expect(readLimitedRequestBody(req, 5)).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("parses empty and valid JSON bodies", () => {
    expect(parseJsonRequestBody("")).toEqual({});
    expect(parseJsonRequestBody('{"ok":true}')).toEqual({ ok: true });
  });

  it("turns invalid JSON into a 400 request error", () => {
    expect(() => parseJsonRequestBody("{nope")).toThrow(HttpRequestError);
    expect(() => parseJsonRequestBody("{nope")).toThrow("Invalid JSON body.");
  });

  it("tracks fixed-window rate limits", () => {
    resetRateLimitBucketsForTests();

    expect(checkRateLimit({ key: "preview:1", limit: 2, now: 1000, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit({ key: "preview:1", limit: 2, now: 1001, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(checkRateLimit({ key: "preview:1", limit: 2, now: 1002, windowMs: 60_000 })).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(checkRateLimit({ key: "preview:1", limit: 2, now: 61_001, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  it("prefers forwarded IP headers", () => {
    expect(
      getRequestIp({
        headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
        socket: { remoteAddress: "127.0.0.1" },
      } as unknown as Parameters<typeof getRequestIp>[0]),
    ).toBe("203.0.113.1");
  });
});
