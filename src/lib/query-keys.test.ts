import { describe, expect, it } from "vitest";
import { queryKeys } from "./query-keys";

describe("query key factory", () => {
  it("produces identical keys for the same entity and scope (cache sharing)", () => {
    // Dashboard and Owner Assistant both scope calls by the active location id.
    expect(queryKeys.calls.list("loc_1")).toEqual(queryKeys.calls.list("loc_1"));
    expect(queryKeys.orders.list("loc_1")).toEqual(queryKeys.orders.list("loc_1"));
  });

  it("distinguishes different scopes", () => {
    expect(queryKeys.calls.list("loc_1")).not.toEqual(queryKeys.calls.list("loc_2"));
    expect(queryKeys.calls.list(null)).not.toEqual(queryKeys.calls.list("loc_1"));
  });

  it("normalizes null to an explicit cross-tenant 'all' scope", () => {
    expect(queryKeys.calls.list(null)).toEqual(["calls", "list", "all"]);
  });

  it("normalizes undefined/empty to the active-location scope", () => {
    expect(queryKeys.orders.list()).toEqual(["orders", "list", "active"]);
    expect(queryKeys.orders.list(undefined)).toEqual(["orders", "list", "active"]);
    expect(queryKeys.orders.list("")).toEqual(["orders", "list", "active"]);
  });

  it("roots every list key under the entity root so invalidation reaches all scopes", () => {
    // React Query invalidates by prefix: invalidating the root must be a prefix
    // of every list key for that entity, regardless of scope.
    const entities = [
      { root: queryKeys.calls.root, lists: [queryKeys.calls.list("loc_1"), queryKeys.calls.list(null), queryKeys.calls.list()] },
      { root: queryKeys.orders.root, lists: [queryKeys.orders.list("loc_1"), queryKeys.orders.list()] },
      { root: queryKeys.reservations.root, lists: [queryKeys.reservations.list("loc_1"), queryKeys.reservations.list()] },
      { root: queryKeys.staffTasks.root, lists: [queryKeys.staffTasks.list("loc_1"), queryKeys.staffTasks.list(null)] },
    ];

    for (const { root, lists } of entities) {
      for (const list of lists) {
        expect(list.slice(0, root.length)).toEqual([...root]);
      }
    }
  });

  it("roots call feedback under the calls entity so call invalidation can include it", () => {
    expect(queryKeys.calls.feedback("call_1").slice(0, 1)).toEqual(["calls"]);
    expect(queryKeys.calls.feedback(null)).toEqual(["calls", "feedback", "none"]);
  });
});
