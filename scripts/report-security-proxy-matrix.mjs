#!/usr/bin/env node
/**
 * Phase 0g: emit artifacts/security-proxy-matrix.json — anonymous proxy policy vs API surface hints.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "artifacts", "security-proxy-matrix.json");

export function extractStringLiteralsFromArray(ts, varName, { exported = true } = {}) {
  const prefix = exported ? "export const" : "const";
  const re = new RegExp(
    `${prefix} ${varName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as const)?`,
    "m"
  );
  const m = re.exec(ts);
  if (!m) return [];
  const body = m[1];
  const out = [];
  for (const sm of body.matchAll(/"([^"]+)"/g)) out.push(sm[1]);
  for (const sm of body.matchAll(/'([^']+)'/g)) out.push(sm[1]);
  return [...new Set(out)];
}

export function buildSecurityProxyMatrix(rootDir = root) {
  const policyPath = path.join(rootDir, "src/lib/auth/proxy-path-policy.ts");
  const marketingPath = path.join(rootDir, "src/lib/marketing/public-paths.ts");
  const policySrc = fs.readFileSync(policyPath, "utf8");
  const marketingSrc = fs.readFileSync(marketingPath, "utf8");

  const publicAuthSurface = extractStringLiteralsFromArray(policySrc, "publicRoutes", {
    exported: false,
  });
  const publicInformation = extractStringLiteralsFromArray(
    marketingSrc,
    "PUBLIC_INFORMATION_PATHS",
    { exported: true }
  );
  const sitemapPaths = extractStringLiteralsFromArray(marketingSrc, "SITEMAP_PATHS", { exported: true });

  const unauthenticatedRules = {
    always_api_prefix: "/api/",
    auth_callback_prefix: "/auth/callback",
    external_participant_prefix: "/external/",
    root_path: "/",
    public_auth_surface_paths: publicAuthSurface,
    public_information_paths: publicInformation,
    crawler_and_metadata: {
      robots: "/robots.txt",
      sitemap: "/sitemap.xml",
      well_known_prefix: "/.well-known/",
      og_image: ["/opengraph-image", "/twitter-image", "/icon", "/apple-icon"],
    },
  };

  const routeMatrixPath = path.join(rootDir, "artifacts", "security-route-matrix.json");
  let apiPublicGuess = [];
  if (fs.existsSync(routeMatrixPath)) {
    const rows = JSON.parse(fs.readFileSync(routeMatrixPath, "utf8"));
    const list = Array.isArray(rows) ? rows : rows.routes;
    if (Array.isArray(list)) {
      apiPublicGuess = list
        .filter((r) => r.public_guess && typeof r.path === "string" && r.path.startsWith("/api/"))
        .map((r) => r.path)
        .sort();
    }
  }

  return {
    version: 1,
    sources: [
      path.relative(rootDir, policyPath).replace(/\\/g, "/"),
      path.relative(rootDir, marketingPath).replace(/\\/g, "/"),
    ],
    unauthenticated_rules: unauthenticatedRules,
    marketing_sitemap_paths: sitemapPaths,
    api_routes_flagged_public_guess: apiPublicGuess,
    notes:
      "Anonymous users may hit /api/*; each route enforces its own auth. public_guess heuristics are not a substitute for handler review.",
  };
}

export function writeSecurityProxyMatrix(rootDir = root, outputPath = outPath) {
  const doc = buildSecurityProxyMatrix(rootDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2) + "\n");
  return { outputPath, doc };
}

function main() {
  const result = writeSecurityProxyMatrix(root, outPath);
  console.log(`Wrote ${result.outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
