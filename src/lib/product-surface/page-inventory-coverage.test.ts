import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { governedPageRootPrefixes } from "@/lib/product-surface/governed-prefixes";
import { resolveFeatureMappingForPagePath } from "@/lib/product-surface/surface-mapping";

const APP_ROOT = path.resolve(process.cwd(), "src/app");

const GOVERNED_ROOT_PREFIXES = governedPageRootPrefixes();

function walkPageFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkPageFiles(full, out);
      continue;
    }
    if (name === "page.tsx") out.push(full);
  }
  return out;
}

function toRoutePath(absFile: string): string {
  const rel = path.relative(APP_ROOT, absFile).split(path.sep).join("/");
  const noPage = rel.replace(/\/page\.tsx$/, "");
  const withGroupsRemoved = noPage
    .split("/")
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/");
  return `/${withGroupsRemoved}`.replace(/\/+/g, "/");
}

function isGovernedRoot(pathname: string): boolean {
  return GOVERNED_ROOT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

describe("v8 page inventory coverage", () => {
  it("maps or exempts all governed page routes", () => {
    const pages = walkPageFiles(APP_ROOT);
    const governedUnmapped: string[] = [];

    for (const pageFile of pages) {
      const routePath = toRoutePath(pageFile);
      const mapping = resolveFeatureMappingForPagePath(routePath);
      if (mapping.status !== "unmapped") continue;
      if (isGovernedRoot(routePath)) governedUnmapped.push(routePath);
    }

    expect(governedUnmapped).toEqual([]);
  });
});
