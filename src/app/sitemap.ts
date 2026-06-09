import type { MetadataRoute } from "next";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { SITEMAP_PATHS } from "@/lib/marketing/public-paths";

export const revalidate = 3600;

function sitemapPriority(path: string): number {
  if (path === "/") return 1;
  if (path === "/request-access") return 0.9;
  if (path === "/product" || path === "/pricing" || path === "/security" || path === "/contact") return 0.8;
  return 0.7;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrlFromEnv();
  const lastModified = new Date();

  return SITEMAP_PATHS.map((path) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified,
    changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: sitemapPriority(path),
  }));
}
