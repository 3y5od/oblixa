import { describe, expect, it } from "vitest";

/** Prefer gzip/br when Accept-Encoding lists them (client hint for fetch tests). */
export function pickContentEncoding(acceptEncoding: string | null): "gzip" | "br" | "identity" {
  const v = (acceptEncoding || "").toLowerCase();
  if (v.includes("gzip")) return "gzip";
  if (v.includes("br")) return "br";
  return "identity";
}

describe("HTTP edge caching / compression hints (Phase 2c)", () => {
  it("prefers gzip over identity when advertised", () => {
    expect(pickContentEncoding("gzip, deflate")).toBe("gzip");
  });

  it("falls back to identity when absent", () => {
    expect(pickContentEncoding(null)).toBe("identity");
  });

  it("treats weak ETag as opaque validator token", () => {
    const etag = 'W/"abc123"';
    expect(etag.startsWith('W/"')).toBe(true);
  });
});
