import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseTimeoutFetch,
  isTransientSupabaseFetchFailure,
  SUPABASE_AUTH_UNAVAILABLE_STATUS,
} from "@/lib/supabase/fetch";

describe("supabase fetch boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns transient network failures into service-unavailable responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      const error = new TypeError("fetch failed") as TypeError & { cause?: { code: string } };
      error.cause = { code: "ECONNREFUSED" };
      throw error;
    }));

    const response = await createSupabaseTimeoutFetch(50)("http://127.0.0.1:54321/auth/v1/token");

    expect(response.status).toBe(SUPABASE_AUTH_UNAVAILABLE_STATUS);
  });

  it("does not classify policy errors as transient network failures", () => {
    expect(isTransientSupabaseFetchFailure(new Error("safeFetch: disallowed host"))).toBe(false);
  });
});
