import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UI_SURFACE_MANIFEST } from "@/lib/qa/ui-surface-manifest";

const MATRIX_ONLY_ROUTES = new Set(["/robots.txt", "/sitemap.xml"]);

function loadTsvRoutes(): string[] {
  const p = path.join(process.cwd(), "scripts", "qa-route-coverage.tsv");
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const routes: string[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const route = lines[i].split("\t")[0]?.trim();
    if (route) routes.push(route);
  }
  return routes;
}

describe("qa-route-coverage.tsv routes vs ROUTE_INVENTORY", () => {
  it("every non-waiver TSV route matches an inventory pattern", () => {
    const patterns = new Set(UI_SURFACE_MANIFEST.map((entry) => entry.route));
    const tsvRoutes = loadTsvRoutes();
    for (const route of tsvRoutes) {
      if (MATRIX_ONLY_ROUTES.has(route)) continue;
      expect(patterns.has(route), `TSV route ${route} not in ROUTE_INVENTORY`).toBe(true);
    }
  });
});
