import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Epic 15 / 35 — next.config must keep API responses non-cacheable at the edge config layer. */
describe("next.config API cache-control contract", () => {
  it("declares private no-store for /api/:path*", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(raw).toContain('source: "/api/:path*"');
    expect(raw).toContain("Cache-Control");
    expect(raw).toContain("no-store");
    expect(raw).toContain("Pragma");
    expect(raw).toContain("Vary");
  });
});
