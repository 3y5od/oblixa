import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_SPEC_TRACE } from "./compatibility-spec-trace-map";

function walkCurrentTestFiles(dir: string, out: string[]): void {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkCurrentTestFiles(p, out);
    } else if (ent.name.endsWith(".test.ts") || ent.name.endsWith(".test.tsx")) {
      out.push(p);
    }
  }
}

function primarySectionNumber(id: string): number {
  const m = id.match(/^(\d+)/);
  return m ? Number(m[1]) : NaN;
}

describe("V9 coverage inventory (plan Tier A + behavioral anchors)", () => {
  it("indexes a non-trivial section set in V9_SPEC_TRACE", () => {
    const ids = Object.keys(V9_SPEC_TRACE);
    expect(ids.length).toBeGreaterThan(100);
    for (const id of ids) {
      expect(V9_SPEC_TRACE[id as keyof typeof V9_SPEC_TRACE], `§${id}`).toBeDefined();
    }
  });

  it("keeps a non-trivial harness of current src test files", () => {
    const files: string[] = [];
    walkCurrentTestFiles(join(process.cwd(), "src"), files);
    expect(files.length).toBeGreaterThanOrEqual(92);
  });

  it("maps §7–§28 headings to at least one product, action, e2e, or UI-test path (beyond global guard bundles)", () => {
    const ids = Object.keys(V9_SPEC_TRACE);
    for (const id of ids) {
      const n = primarySectionNumber(id);
      if (n < 7 || n > 28) continue;
      const arts = V9_SPEC_TRACE[id as keyof typeof V9_SPEC_TRACE] ?? [];
      const anchored = arts.filter(
        (a) =>
          !a.includes("v9-security-surface-guard.v9.test.ts") &&
          !a.includes("v9-acceptance-bundle.v9.test.ts")
      );
      expect(anchored.length, `§${id} must not be guard-only`).toBeGreaterThan(0);
      const hasAnchor = anchored.some((a) => {
        if (a.startsWith("e2e/")) return true;
        if (a.endsWith(".ui.test.tsx")) return true;
        if (a.startsWith("src/app/")) return true;
        if (a.startsWith("src/components/")) return true;
        if (a.startsWith("src/actions/")) return true;
        if (a.startsWith("src/lib/") && !a.includes(".test.")) return true;
        return false;
      });
      expect(hasAnchor, `§${id} needs app, components, actions, lib module, ui test, or e2e anchor`).toBe(true);
    }
  });
});
