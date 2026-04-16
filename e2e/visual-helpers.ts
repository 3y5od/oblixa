export const VISUAL_ENABLED =
  process.env.PLAYWRIGHT_VISUAL === "1" || process.env.PLAYWRIGHT_VISUAL === "true";

export const VISUAL_AUTH_ENABLED =
  VISUAL_ENABLED &&
  (process.env.PLAYWRIGHT_VISUAL_AUTH === "1" || process.env.PLAYWRIGHT_VISUAL_AUTH === "true");

export const VISUAL_ADVANCED_ENABLED =
  VISUAL_ENABLED &&
  (process.env.PLAYWRIGHT_VISUAL_ADVANCED === "1" ||
    process.env.PLAYWRIGHT_VISUAL_ADVANCED === "true");

export const VISUAL_ASSURANCE_ENABLED =
  VISUAL_ENABLED &&
  (process.env.PLAYWRIGHT_VISUAL_ASSURANCE === "1" ||
    process.env.PLAYWRIGHT_VISUAL_ASSURANCE === "true");

export function snapshotName(prefix: string, route: string) {
  const normalized = route
    .replace(/^\//, "")
    .replace(/\//g, "__")
    .replace(/\[|\]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${prefix}-${normalized || "root"}.png`;
}

