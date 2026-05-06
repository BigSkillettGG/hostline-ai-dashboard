import { describe, expect, it } from "vitest";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

describe("buildSupabaseServiceHeaders", () => {
  it("omits bearer auth for modern Supabase secret keys", () => {
    const headers = buildSupabaseServiceHeaders("sb_secret_test", {
      Prefer: "return=representation",
    });

    expect(headers).toEqual({
      apikey: "sb_secret_test",
      "Content-Type": "application/json",
      Prefer: "return=representation",
    });
  });

  it("keeps bearer auth for legacy service role JWTs", () => {
    expect(buildSupabaseServiceHeaders("legacy_service_role_jwt")).toEqual({
      apikey: "legacy_service_role_jwt",
      Authorization: "Bearer legacy_service_role_jwt",
      "Content-Type": "application/json",
    });
  });
});
