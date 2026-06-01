import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REQUEST_TIMEOUT_MS, fetchWithTimeout } from "./fetch-with-timeout";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("returns the response when fetch resolves in time", async () => {
    const response = new Response("ok", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(fetchWithTimeout("https://example.test", {}, 1_000)).resolves.toBe(response);
  });

  it("throws a clear, status-less timeout error when fetch hangs", async () => {
    vi.useFakeTimers();
    // Simulate real fetch: never resolves on its own, rejects with AbortError
    // when the provided signal is aborted.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );

    const promise = fetchWithTimeout("https://example.test", {}, 1_000, "Supabase calls request");
    // Attach a catch handler before advancing timers so the rejection is observed.
    const assertion = expect(promise).rejects.toThrow("Supabase calls request timed out after 1000ms");
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("does not tag a timeout error with an HTTP status (so retry treats it as transient)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    const promise = fetchWithTimeout("https://example.test", {}, 500);
    const assertion = promise.catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(500);
    const message = await assertion;
    expect(message).not.toMatch(/failed:\s*\d{3}/);
  });

  it("propagates non-timeout fetch errors unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchWithTimeout("https://example.test", {}, 1_000)).rejects.toThrow("Failed to fetch");
  });

  it("clears the timeout when the request succeeds (no lingering timers)", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")));

    await fetchWithTimeout("https://example.test", {}, 1_000);
    expect(clearSpy).toHaveBeenCalled();
  });

  it("exposes a sane default timeout", () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(15_000);
  });
});
