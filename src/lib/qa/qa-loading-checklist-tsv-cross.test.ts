import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function loadLoadingChecklistRoutes(): string[] {
  const p = path.join(process.cwd(), "scripts", "qa-loading-routes-checklist.txt");
  const raw = fs.readFileSync(p, "utf8");
  const routes: string[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    routes.push(parts[0]);
  }
  return routes;
}

function loadingCheckedMap(): Map<string, string> {
  const p = path.join(process.cwd(), "scripts", "qa-route-coverage.tsv");
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const header = lines[0].split("\t");
  const routeIdx = header.indexOf("route");
  const loadIdx = header.indexOf("loading_checked");
  expect(routeIdx).toBeGreaterThanOrEqual(0);
  expect(loadIdx).toBeGreaterThanOrEqual(0);
  const m = new Map<string, string>();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split("\t");
    while (cols.length < header.length) cols.push("");
    const route = cols[routeIdx]?.trim();
    const lc = cols[loadIdx]?.trim();
    if (route) m.set(route, lc ?? "");
  }
  return m;
}

/** Routes listed in loading checklist but TSV still marks loading_checked=n until human sign-off. */
const LOADING_TSV_MISMATCH_ALLOWLIST = new Set<string>([
  // Add paths here if checklist is ahead of TSV human column.
]);

describe("qa-loading-routes-checklist vs TSV loading_checked", () => {
  it("each checklist route has loading_checked=y in TSV or is allowlisted", () => {
    const tsv = loadingCheckedMap();
    for (const route of loadLoadingChecklistRoutes()) {
      if (LOADING_TSV_MISMATCH_ALLOWLIST.has(route)) continue;
      const v = tsv.get(route);
      expect(v, `TSV missing route ${route}`).toBeDefined();
      expect(v, `Route ${route} should have loading_checked=y in TSV (or add allowlist)`).toBe("y");
    }
  });
});
