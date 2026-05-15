import type { IncomingMessage } from "node:http";

export class HttpRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export interface RateLimitResult {
  allowed: boolean;
  backend?: "memory" | "redis";
  degraded?: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const REDIS_RATE_LIMIT_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return { current, ttl }",
].join("\n");

export async function readLimitedRequestBody(req: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > maxBytes) {
      throw new HttpRequestError(413, `Request body exceeds ${maxBytes} bytes.`);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export function parseJsonRequestBody(body: string) {
  if (!body.trim()) return {};

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpRequestError(400, "Invalid JSON body.");
  }
}

export function checkRateLimit({
  key,
  limit,
  now = Date.now(),
  windowMs,
}: {
  key: string;
  limit: number;
  now?: number;
  windowMs: number;
}): RateLimitResult {
  if (rateLimitBuckets.size > 1000) {
    pruneExpiredRateLimitBuckets(now);
  }

  const existing = rateLimitBuckets.get(key);
  const bucket = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + windowMs };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  const allowed = bucket.count <= limit;
  return {
    allowed,
    backend: "memory",
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export async function checkDistributedRateLimit({
  fetchImpl = fetch,
  key,
  limit,
  now = Date.now(),
  redisRestToken,
  redisRestUrl,
  windowMs,
}: {
  fetchImpl?: typeof fetch;
  key: string;
  limit: number;
  now?: number;
  redisRestToken?: string;
  redisRestUrl?: string;
  windowMs: number;
}): Promise<RateLimitResult> {
  if (!redisRestUrl || !redisRestToken) {
    return checkRateLimit({ key, limit, now, windowMs });
  }

  try {
    return await checkRedisRestRateLimit({
      fetchImpl,
      key,
      limit,
      now,
      redisRestToken,
      redisRestUrl,
      windowMs,
    });
  } catch (error) {
    console.warn("[http-safety] Redis rate limit unavailable; falling back to local memory bucket", {
      error,
      key,
    });
    return {
      ...checkRateLimit({ key, limit, now, windowMs }),
      degraded: true,
    };
  }
}

export function getRequestIp(req: IncomingMessage) {
  const forwardedFor = headerValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return (
    headerValue(req.headers["cf-connecting-ip"]) ||
    headerValue(req.headers["x-real-ip"]) ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

export function resetRateLimitBucketsForTests() {
  rateLimitBuckets.clear();
}

function pruneExpiredRateLimitBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
}

async function checkRedisRestRateLimit({
  fetchImpl,
  key,
  limit,
  now,
  redisRestToken,
  redisRestUrl,
  windowMs,
}: {
  fetchImpl: typeof fetch;
  key: string;
  limit: number;
  now: number;
  redisRestToken: string;
  redisRestUrl: string;
  windowMs: number;
}): Promise<RateLimitResult> {
  const response = await fetchImpl(redisRestUrl.replace(/\/$/, ""), {
    body: JSON.stringify([
      "EVAL",
      REDIS_RATE_LIMIT_SCRIPT,
      1,
      `signalhost:rate:${key}`,
      String(windowMs),
    ]),
    headers: {
      Authorization: `Bearer ${redisRestToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Redis rate limit failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json() as { error?: unknown; result?: unknown };
  if (payload.error) {
    throw new Error(`Redis rate limit failed: ${String(payload.error)}`);
  }

  const result = Array.isArray(payload.result) ? payload.result : [];
  const count = Number(result[0]);
  const ttlMs = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
    throw new Error("Redis rate limit returned an invalid response.");
  }

  const resetAt = now + Math.max(1, ttlMs);
  return {
    allowed: count <= limit,
    backend: "redis",
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
