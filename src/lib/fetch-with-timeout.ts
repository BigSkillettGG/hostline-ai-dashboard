export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * fetch() with a hard timeout.
 *
 * The browser's fetch has no built-in timeout: if the network stalls or the
 * server never responds, the promise hangs forever and any UI waiting on it
 * spins indefinitely. This wraps fetch in an AbortController that fires after
 * `timeoutMs`, so a stalled request fails cleanly instead.
 *
 * On timeout it throws a plain Error whose message contains no HTTP status
 * code. That is deliberate: the app's query retry policy retries status-less
 * (network-class) errors, so a transient stall is retried, while a real 4xx
 * from the server is not.
 *
 * Each call gets its own controller and timer, so callers that retry (e.g. the
 * Supabase data layer's 401 refresh-and-retry) get a fresh timeout per attempt.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  label?: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${label ?? "Request"} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
