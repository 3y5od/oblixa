import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GENERATED_AUTHENTICATED_CORE_A11Y_PATHS,
  GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS,
} from "@/lib/qa/generated-route-matrices";

function loadTsvRoutes(): Set<string> {
  const p = path.join(process.cwd(), "scripts", "qa-route-coverage.tsv");
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const routes = new Set<string>();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split("\t");
    const route = cols[0]?.trim();
    if (route) routes.add(route);
  }
  return routes;
}

describe("qa-route-coverage.tsv vs E2E path matrices", () => {
  it("every AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS row exists in TSV", () => {
    const routes = loadTsvRoutes();
    for (const p of GENERATED_AUTHENTICATED_CORE_A11Y_PATHS) {
      expect(routes.has(p), `Missing TSV row for ${p}`).toBe(true);
    }
  });

  it("every REFINEMENT_S10_4_UTILITY_PATHS row exists in TSV", () => {
    const routes = loadTsvRoutes();
    for (const p of GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS) {
      expect(routes.has(p), `Missing TSV row for ${p}`).toBe(true);
    }
  });
});
