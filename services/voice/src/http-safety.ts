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
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

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
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
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

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
