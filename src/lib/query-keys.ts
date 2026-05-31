/**
 * Centralized React Query key factory.
 *
 * Why this exists: the same underlying data (calls, orders, reservations, staff
 * tasks) is shown on multiple pages. Previously each page invented its own key
 * prefix (e.g. ["dashboard","calls",...] vs ["calls","supabase",...]), so a
 * mutation on one page invalidated only its own key and left every other page
 * showing stale data until the next poll.
 *
 * React Query invalidation is prefix-based: invalidating ["calls"] matches every
 * key that starts with ["calls"]. By routing every query for an entity through
 * this factory — all rooted at the same entity prefix — a single
 * `invalidateQueries({ queryKey: queryKeys.calls.root })` reliably refreshes the
 * Dashboard, the Calls page, the Owner Assistant, and the Tenant Detail view at
 * once.
 *
 * `scope` distinguishes which slice of data a query shows:
 *   - a location id string  -> that specific location
 *   - null                  -> explicit cross-tenant ("all") view (super admin)
 *   - undefined             -> the active location (resolved inside the fetcher)
 * Different scopes get different leaf keys (so cross-tenant views don't collide
 * with single-location views), but they all share the entity root, so
 * invalidation at the root reaches all of them.
 */

function normalizeScope(scope?: string | null): string {
  if (scope === null) return "all";
  if (scope === undefined || scope === "") return "active";
  return scope;
}

export const queryKeys = {
  calls: {
    root: ["calls"] as const,
    list: (scope?: string | null) => ["calls", "list", normalizeScope(scope)] as const,
    feedback: (callId: string | null | undefined) => ["calls", "feedback", callId ?? "none"] as const,
  },
  orders: {
    root: ["orders"] as const,
    list: (scope?: string | null) => ["orders", "list", normalizeScope(scope)] as const,
  },
  reservations: {
    root: ["reservations"] as const,
    list: (scope?: string | null) => ["reservations", "list", normalizeScope(scope)] as const,
  },
  staffTasks: {
    root: ["staff-tasks"] as const,
    list: (scope?: string | null) => ["staff-tasks", "list", normalizeScope(scope)] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
