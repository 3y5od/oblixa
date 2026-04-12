import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  PUBLIC_INFORMATION_PATHS,
  SITEMAP_PATHS,
  isMetadataImageRoute,
  isPublicInformationPath,
} from "@/lib/marketing/public-paths";

function pathnameFromSitemapUrl(url: string): string {
  const p = new URL(url).pathname;
  return p === "" ? "/" : p;
}

describe("marketing public paths", () => {
  it("isPublicInformationPath matches PUBLIC_INFORMATION_PATHS", () => {
    for (const path of PUBLIC_INFORMATION_PATHS) {
      expect(isPublicInformationPath(path), path).toBe(true);
    }
    expect(isPublicInformationPath("/dashboard")).toBe(false);
  });

  it("every PUBLIC_INFORMATION_PATH is listed in SITEMAP_PATHS", () => {
    const set = new Set(SITEMAP_PATHS as readonly string[]);
    for (const p of PUBLIC_INFORMATION_PATHS) {
      expect(set.has(p), p).toBe(true);
    }
  });

  it("sitemap includes an entry for every SITEMAP_PATH", () => {
    const entries = sitemap();
    const paths = new Set(entries.map((e) => pathnameFromSitemapUrl(e.url)));
    for (const path of SITEMAP_PATHS) {
      expect(paths.has(path), `missing sitemap path ${path}`).toBe(true);
    }
  });

  it("robots() returns a valid shape", () => {
    const r = robots();
    expect(r).toBeDefined();
    expect(r.rules).toBeDefined();
  });

  it("metadata image routes are recognized for middleware allowlist", () => {
    expect(isMetadataImageRoute("/opengraph-image")).toBe(true);
    expect(isMetadataImageRoute("/twitter-image")).toBe(true);
    expect(isMetadataImageRoute("/icon")).toBe(true);
    expect(isMetadataImageRoute("/apple-icon")).toBe(true);
  });

  it("proxy gates unauthenticated access via proxy-path-policy (source drift guard)", () => {
    const proxyPath = path.join(process.cwd(), "src", "proxy.ts");
    const src = fs.readFileSync(proxyPath, "utf8");
    expect(src).toContain("@/lib/auth/proxy-path-policy");
    expect(src).toContain("unauthenticatedAccessAllowed");
    const policyPath = path.join(process.cwd(), "src", "lib", "auth", "proxy-path-policy.ts");
    const policy = fs.readFileSync(policyPath, "utf8");
    expect(policy).toContain("isPublicInformationPath");
    expect(policy).toContain("isMetadataImageRoute");
    expect(policy).toContain("robots.txt");
  });
});
