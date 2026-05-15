import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  checkDistributedRateLimit,
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

  it("can use a Redis REST fixed-window limiter for multi-instance deployments", async () => {
    const requests: unknown[] = [];
    const result = await checkDistributedRateLimit({
      fetchImpl: (async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ result: [2, 45_000] }), { status: 200 });
      }) as typeof fetch,
      key: "web-chat:203.0.113.1",
      limit: 3,
      now: 1_000,
      redisRestToken: "redis-token",
      redisRestUrl: "https://redis.example",
      windowMs: 60_000,
    });

    expect(result).toMatchObject({
      allowed: true,
      backend: "redis",
      remaining: 1,
      resetAt: 46_000,
      retryAfterSeconds: 45,
    });
    expect(requests[0]).toEqual([
      "EVAL",
      expect.stringContaining("INCR"),
      1,
      "signalhost:rate:web-chat:203.0.113.1",
      "60000",
    ]);
  });

  it("falls back to local buckets when Redis rate limiting is unavailable", async () => {
    resetRateLimitBucketsForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const result = await checkDistributedRateLimit({
        fetchImpl: (async () => new Response("nope", { status: 503 })) as typeof fetch,
        key: "preview:redis-down",
        limit: 1,
        now: 1_000,
        redisRestToken: "redis-token",
        redisRestUrl: "https://redis.example",
        windowMs: 60_000,
      });

      expect(result).toMatchObject({
        allowed: true,
        backend: "memory",
        degraded: true,
      });
      expect(warn).toHaveBeenCalledWith(
        "[http-safety] Redis rate limit unavailable; falling back to local memory bucket",
        expect.objectContaining({ key: "preview:redis-down" }),
      );
    } finally {
      warn.mockRestore();
    }
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
