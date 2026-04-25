import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectErrorBoundaries(dir: string, out: string[]): void {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "api" && dir.endsWith("app")) continue;
      collectErrorBoundaries(p, out);
    } else if (ent.name === "error.tsx") {
      out.push(p);
    }
  }
}

describe("client error boundaries capture diagnostics (V9 §22.4)", () => {
  it("wires captureClientException in every app segment error.tsx", () => {
    const root = join(process.cwd(), "src/app");
    const files: string[] = [];
    collectErrorBoundaries(root, files);
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const abs of files.sort()) {
      const rel = abs.replace(process.cwd() + "/", "");
      const src = readFileSync(abs, "utf8");
      expect(src, rel).toContain("captureClientException");
      expect(src, rel).toContain("@/lib/observability/sentry");
    }
  });
});
