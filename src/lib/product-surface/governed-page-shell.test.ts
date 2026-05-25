import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { governedPageRootPrefixes } from "@/lib/product-surface/governed-prefixes";

const APP_ROOT = path.resolve(process.cwd(), "src/app");
const DASHBOARD_ROOT = join(APP_ROOT, "(dashboard)");

/** Paths that are governed URLs but legitimately live outside `(dashboard)` (marketing, auth, external, etc.). */
const GOVERNED_PAGE_EXCEPTIONS: readonly string[] = [];

function walkPageFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkPageFiles(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

function toUrlPath(absFile: string): string {
  const rel = path.relative(APP_ROOT, absFile).split(path.sep).join("/");
  const noPage = rel.replace(/\/page\.tsx$/, "");
  const withGroupsRemoved = noPage
    .split("/")
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/");
  return `/${withGroupsRemoved}`.replace(/\/+/g, "/");
}

function isUnderDashboard(absFile: string): boolean {
  const rel = path.relative(DASHBOARD_ROOT, absFile).split(path.sep).join("/");
  return !rel.startsWith("..");
}

function matchesGovernedPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

describe("governed page shell vs route groups (§11.1)", () => {
  it("places governed-prefix pages under (dashboard) or the explicit exception list", () => {
    const prefixes = governedPageRootPrefixes();
    const pages = walkPageFiles(APP_ROOT);
    const bad: string[] = [];

    for (const pageFile of pages) {
      const routePath = toUrlPath(pageFile);
      if (!matchesGovernedPrefix(routePath, prefixes)) continue;
      const excepted = GOVERNED_PAGE_EXCEPTIONS.some(
        (e) => routePath === e || routePath.startsWith(`${e}/`)
      );
      if (excepted) continue;
      if (!isUnderDashboard(pageFile)) bad.push(routePath);
    }

    expect(bad, `Governed pages outside (dashboard): ${bad.join(", ")}`).toEqual([]);
  });

  it("dashboard route group exists", () => {
    expect(existsSync(join(DASHBOARD_ROOT, "layout.tsx"))).toBe(true);
  });
});
