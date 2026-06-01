import { describe, expect, it, vi } from "vitest";
import { chunkArray, fetchInBatches, MAX_IDS_PER_QUERY } from "./batch";

describe("chunkArray", () => {
  it("returns a single chunk when the list fits", () => {
    expect(chunkArray([1, 2, 3], 50)).toEqual([[1, 2, 3]]);
  });

  it("returns an empty array for an empty list", () => {
    expect(chunkArray([], 50)).toEqual([]);
  });

  it("splits a long list into evenly sized chunks", () => {
    const ids = Array.from({ length: 120 }, (_, i) => i);
    const chunks = chunkArray(ids, 50);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[1]).toHaveLength(50);
    expect(chunks[2]).toHaveLength(20);
    expect(chunks.flat()).toEqual(ids);
  });

  it("throws on a non-positive chunk size", () => {
    expect(() => chunkArray([1], 0)).toThrow();
  });
});

describe("fetchInBatches", () => {
  it("returns [] without calling request for an empty id list", async () => {
    const request = vi.fn();
    await expect(fetchInBatches([], request)).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it("makes a single request for a small id list", async () => {
    const request = vi.fn().mockResolvedValue([{ ok: true }]);
    const result = await fetchInBatches(["a", "b"], request);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("in.(a,b)");
    expect(result).toEqual([{ ok: true }]);
  });

  it("splits into multiple requests and flattens results", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);
    const request = vi.fn((inFilter: string) => {
      // Return one row per batch so we can count batches via the result length.
      return Promise.resolve([{ inFilter }]);
    });
    const result = await fetchInBatches(ids, request, 50);
    expect(request).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    // Each generated filter stays short (well under proxy URL caps).
    for (const call of request.mock.calls) {
      expect(call[0].length).toBeLessThan(2_000);
    }
  });

  it("keeps a 50-id default batch URL comfortably under 2,048 chars", () => {
    // A realistic UUID-length id list at the default batch size.
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const ids = Array.from({ length: MAX_IDS_PER_QUERY }, () => uuid);
    const filter = `in.(${ids.join(",")})`;
    expect(filter.length).toBeLessThan(2_048);
  });
});
