import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Epic 15 / 35 — next.config must keep API responses non-cacheable at the edge config layer. */
describe("next.config API cache-control contract", () => {
  it("declares private no-store for /api/:path*", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    const headers = fs.readFileSync(path.join(process.cwd(), "src/lib/security/csp-builders.ts"), "utf8");
    expect(raw).toContain('source: "/api/:path*"');
    expect(raw).toContain("buildApiNoStoreHeaders");
    expect(raw).toContain("headers: apiNoStoreHeaders");
    expect(headers).toContain("Cache-Control");
    expect(headers).toContain("private, no-store, max-age=0, must-revalidate");
    expect(headers).toContain("Pragma");
    expect(headers).toContain("Expires");
    expect(headers).toContain("Surrogate-Control");
    expect(headers).toContain("Cookie, Authorization");
  });
});
