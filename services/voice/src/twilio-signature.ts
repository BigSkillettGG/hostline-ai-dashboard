import { createHmac, timingSafeEqual } from "node:crypto";

export function validateTwilioSignature({
  authToken,
  expectedSignature,
  params = {},
  url,
}: {
  authToken: string;
  expectedSignature?: string | string[];
  params?: Record<string, string>;
  url: string;
}) {
  if (!expectedSignature) return false;

  const signature = Array.isArray(expectedSignature) ? expectedSignature[0] : expectedSignature;
  const computed = computeTwilioSignature({ authToken, params, url });

  const signatureBuffer = Buffer.from(signature);
  const computedBuffer = Buffer.from(computed);
  return signatureBuffer.length === computedBuffer.length && timingSafeEqual(signatureBuffer, computedBuffer);
}

export function computeTwilioSignature({
  authToken,
  params = {},
  url,
}: {
  authToken: string;
  params?: Record<string, string>;
  url: string;
}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return createHmac("sha1", authToken).update(`${url}${sortedParams}`, "utf8").digest("base64");
}
