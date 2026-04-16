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
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
