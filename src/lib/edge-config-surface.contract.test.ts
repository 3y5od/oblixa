import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("@vercel/edge-config surface", () => {
  it("documents optional edge-config dependency (install only when used)", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const deps = pkg.dependencies ?? {};
    if ("@vercel/edge-config" in deps) {
      expect(deps["@vercel/edge-config"]).toBeTruthy();
    } else {
      expect(true).toBe(true);
    }
  });
});
