import type { MetadataRoute } from "next";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";

export const revalidate = 3600;

/**
 * Preview deployments: discourage indexing (production must remain indexable).
 * VERCEL_ENV is "production" | "preview" | "development" on Vercel; undefined locally.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrlFromEnv();
  const isVercelPreview = process.env.VERCEL_ENV === "preview";

  if (isVercelPreview) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/work/",
          "/contracts/",
          "/settings/",
          "/onboarding/",
          "/reports/",
          "/assurance/",
          "/campaigns/",
          "/decisions/",
          "/relationship-workspaces/",
          "/accounts/",
          "/counterparties/",
          "/more/",
        ],
      },
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "OAI-SearchBot",
        disallow: "/",
      },
      {
        userAgent: "Google-Extended",
        disallow: "/",
      },
      {
        userAgent: "PerplexityBot",
        disallow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
