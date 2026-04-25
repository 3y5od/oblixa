import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildStrictCspReportOnly,
} from "@/lib/security/csp-builders";

function directiveMap(csp: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const part of csp.split(";").map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(" ");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    m.set(name, value);
  }
  return m;
}

describe("next.config CSP parity", () => {
  it("wires next.config to shared CSP builders", () => {
    const raw = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(raw).toContain("@/lib/security/csp-builders");
    expect(raw).toContain("buildSecurityHeaders");
  });

  it("keeps enforcing CSP and report-only aligned on third-party hosts (img, connect, frame, worker)", () => {
    for (const isProd of [true, false]) {
      const csp = buildContentSecurityPolicy(isProd);
      const ro = buildStrictCspReportOnly(isProd);
      const a = directiveMap(csp);
      const b = directiveMap(ro);
      for (const key of ["img-src", "connect-src", "frame-src", "worker-src"] as const) {
        expect(a.get(key), `${key} prod=${isProd}`).toBe(b.get(key));
      }
    }
  });
});
