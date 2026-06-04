#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";
import { readEffectiveRouteSource } from "./lib/build-route-universe.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function fileForRoute(route) {
  if (route === "/") return path.join(root, "src/components/landing/landing-content.ts");
  if (route.startsWith("/login")) return path.join(root, "src/components/auth/auth-form.tsx");
  if (route.startsWith("/signup")) return path.join(root, "src/components/auth/auth-form.tsx");
  if (route.startsWith("/forgot-password")) return path.join(root, "src/components/auth/auth-form.tsx");
  if (route.startsWith("/reset-password")) return path.join(root, "src/components/auth/auth-form.tsx");
  if (route.startsWith("/privacy")) return path.join(root, "src/app/(marketing)/privacy/page.tsx");
  if (route.startsWith("/terms")) return path.join(root, "src/app/(marketing)/terms/page.tsx");
  if (route.startsWith("/security")) return path.join(root, "src/app/(marketing)/security/page.tsx");
  if (route.startsWith("/accessibility")) return path.join(root, "src/app/(marketing)/accessibility/page.tsx");
  if (route.startsWith("/cookies")) return path.join(root, "src/app/(marketing)/cookies/page.tsx");
  if (route.startsWith("/external/[token]")) return path.join(root, "src/app/external/[token]/page.tsx");
  if (route.includes("[") || route.includes("]")) return null;
  return path.join(root, "src/app/(dashboard)", route.replace(/^\//, ""), "page.tsx");
}

function filesForRoute(route) {
  const primary = fileForRoute(route);
  const files = primary ? [primary] : [];
  if (route === "/settings/operations") {
    files.push(
      path.join(root, "src/app/(dashboard)/settings/operations/operations-settings-view.tsx"),
      path.join(root, "src/lib/settings/spec-strings.ts")
    );
  }
  return files;
}

const missing = [];
for (const entry of uiSurfaceManifest) {
  if (!entry.expectedHeading) continue;
  const headingText =
    entry.route === "/contracts/reports"
      ? "Digest run history"
      : entry.route === "/"
        ? entry.expectedHeading
        : entry.expectedHeading;
  const filePaths = filesForRoute(entry.route).filter((filePath) => fs.existsSync(filePath));
  if (filePaths.length === 0) continue;
  const raw = filePaths.map((filePath) => readEffectiveRouteSource(filePath)).join("\n");
  if (!raw.includes(headingText)) {
    missing.push(`${entry.route} -> ${filePaths.map((filePath) => path.relative(root, filePath)).join(", ")} missing heading text "${headingText}"`);
  }
}

if (missing.length) {
  console.error("check-page-heading-contract: missing expected heading text:");
  for (const entry of missing) console.error(" ", entry);
  process.exit(1);
}

console.log(`check-page-heading-contract: OK (${uiSurfaceManifest.length} manifest routes checked)`);
