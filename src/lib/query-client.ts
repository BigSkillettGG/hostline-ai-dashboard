import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

/**
 * Extracts an HTTP status code from a thrown error when possible.
 *
 * The Supabase data layer throws errors shaped like
 *   "Supabase <table> request failed: 401 <body>"
 * so we parse the status out of the message. Returns undefined when no status
 * can be determined (e.g. a network failure with no response).
 */
export function extractErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;
  const match = error.message.match(/failed:\s*(\d{3})\b/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Decides whether a failed query should be retried.
 *
 * - Client errors (4xx: unauthorized, forbidden, not found, bad request) are
 *   not retried — retrying will not change the outcome and just hammers the API.
 *   Token-expiry 401s are already handled by a reactive refresh+retry inside the
 *   data layer, so by the time an error surfaces here it is a genuine failure.
 * - Everything else (network errors, 5xx) is retried up to twice with backoff.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = extractErrorStatus(error);
  if (status !== undefined && status >= 400 && status < 500) {
    return false;
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Treat data as fresh for 30s. This prevents an immediate refetch every
        // time a component mounts or the window regains focus, which — combined
        // with the existing refetchInterval polling — was producing a redundant
        // request storm against Supabase. Polling (refetchInterval) is
        // independent of staleTime and continues to keep data current.
        staleTime: 30_000,
        // Keep unused query data cached for 5 minutes before garbage collection
        // so quick back-and-forth navigation is instant.
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
        // Refetch on focus only if data is older than staleTime, so returning to
        // a tab refreshes genuinely stale data without spamming requests.
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Writes are user-initiated; silently retrying them can cause duplicate
        // side effects. Pages handle write failures explicitly.
        retry: false,
      },
    },
    // Global observability: log every query/mutation failure in one place with
    // its key, so failures are debuggable without per-call logging. User-facing
    // error messaging stays in the pages to avoid double-toasting.
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error("[query] request failed", query.queryKey, error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        console.error("[mutation] request failed", mutation.options.mutationKey ?? "(unkeyed)", error);
      },
    }),
  });
}
