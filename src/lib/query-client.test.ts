import { describe, expect, it } from "vitest";
import { createQueryClient, extractErrorStatus, shouldRetryQuery } from "./query-client";

describe("extractErrorStatus", () => {
  it("pulls the status out of a Supabase data-layer error", () => {
    expect(extractErrorStatus(new Error("Supabase calls request failed: 401 unauthorized"))).toBe(401);
    expect(extractErrorStatus(new Error("Supabase orders request failed: 503 service unavailable"))).toBe(503);
  });

  it("returns undefined when there is no status (e.g. network error)", () => {
    expect(extractErrorStatus(new Error("Failed to fetch"))).toBeUndefined();
    expect(extractErrorStatus("not an error object")).toBeUndefined();
    expect(extractErrorStatus(undefined)).toBeUndefined();
  });
});

describe("shouldRetryQuery", () => {
  it("does not retry client errors (4xx)", () => {
    const err401 = new Error("Supabase calls request failed: 401 unauthorized");
    const err404 = new Error("Supabase calls request failed: 404 not found");
    expect(shouldRetryQuery(0, err401)).toBe(false);
    expect(shouldRetryQuery(0, err404)).toBe(false);
  });

  it("retries server errors up to twice", () => {
    const err500 = new Error("Supabase calls request failed: 500 server error");
    expect(shouldRetryQuery(0, err500)).toBe(true);
    expect(shouldRetryQuery(1, err500)).toBe(true);
    expect(shouldRetryQuery(2, err500)).toBe(false);
  });

  it("retries network errors with no status up to twice", () => {
    const netErr = new Error("Failed to fetch");
    expect(shouldRetryQuery(0, netErr)).toBe(true);
    expect(shouldRetryQuery(2, netErr)).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("applies the configured defaults", () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.gcTime).toBe(5 * 60_000);
    expect(defaults.mutations?.retry).toBe(false);
    expect(typeof defaults.queries?.retry).toBe("function");
  });
});
