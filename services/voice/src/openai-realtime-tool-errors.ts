export type RealtimeToolErrorType =
  | "messaging_error"
  | "persistence_error"
  | "reservation_provider_error"
  | "tool_error"
  | "validation_error";

export function classifyRealtimeToolError(error: unknown): RealtimeToolErrorType {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/supabase|rest\/v1|PGRST|relation|schema cache|database/i.test(message)) return "persistence_error";
  if (/validation|required|invalid|missing/i.test(message)) return "validation_error";
  if (/twilio|sms|message|phone/i.test(message)) return "messaging_error";
  if (/reservation|opentable|resy|sevenrooms|tock|yelp/i.test(message)) return "reservation_provider_error";
  return "tool_error";
}
