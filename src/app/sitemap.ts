import type { MetadataRoute } from "next";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { SITEMAP_PATHS } from "@/lib/marketing/public-paths";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrlFromEnv();
  const lastModified = new Date();

  return SITEMAP_PATHS.map((path) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified,
    changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: path === "/" ? 1 : path === "/signup" ? 0.9 : 0.7,
  }));
}
