#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const BASE_URL = (process.env.BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
const OUTPUT_ROOT = path.resolve(process.cwd(), "test-results", "visual-export");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(OUTPUT_ROOT, TIMESTAMP);

function sanitizeName(route) {
  if (route === "/") return "home";
  return route.replace(/^\//, "").replace(/\//g, "__").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function normalizeRoute(route) {
  const trimmed = route.trim();
  if (!trimmed) return null;
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

async function discoverRoutesFromAppDir() {
  const appDir = path.resolve(process.cwd(), "src", "app");
  const routes = new Set(["/"]);

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!/^page\.(tsx|ts|jsx|js|mdx)$/.test(entry.name)) continue;

      const relativeDir = path.relative(appDir, path.dirname(fullPath));
      const segments = relativeDir
        .split(path.sep)
        .filter(Boolean)
        .filter((segment) => !segment.startsWith("(") && !segment.startsWith("@"))
        .filter((segment) => segment !== "api");

      if (segments.some((segment) => segment.includes("[") || segment.includes("]"))) continue;
      routes.add(`/${segments.join("/")}`.replace(/\/+$/, "") || "/");
    }
  }

  await walk(appDir);
  return [...routes].sort((a, b) => a.localeCompare(b));
}

async function resolveRoutes() {
  if (process.env.PATHS) {
    return process.env.PATHS.split(",").map(normalizeRoute).filter(Boolean);
  }
  return discoverRoutesFromAppDir();
}

async function captureRoute(page, route, outputPath) {
  const targetUrl = `${BASE_URL}${route}`;
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 45_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outputPath, fullPage: true });
}

async function main() {
  const routes = await resolveRoutes();
  const browser = await chromium.launch({ headless: true });

  const contexts = [
    { label: "desktop", options: { viewport: { width: 1440, height: 2400 } } },
    { label: "mobile", options: { ...devices["iPhone 14"] } },
  ];

  await fs.mkdir(RUN_DIR, { recursive: true });

  const manifest = {
    baseUrl: BASE_URL,
    outputDir: RUN_DIR,
    routes,
    captures: [],
    failures: [],
  };

  for (const contextConfig of contexts) {
    const contextDir = path.join(RUN_DIR, contextConfig.label);
    await fs.mkdir(contextDir, { recursive: true });
    const context = await browser.newContext(contextConfig.options);
    const page = await context.newPage();

    for (const route of routes) {
      const fileName = `${sanitizeName(route)}.png`;
      const outputPath = path.join(contextDir, fileName);
      try {
        await captureRoute(page, route, outputPath);
        manifest.captures.push({
          device: contextConfig.label,
          route,
          file: path.relative(process.cwd(), outputPath),
        });
        process.stdout.write(`captured ${contextConfig.label} ${route}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        manifest.failures.push({ device: contextConfig.label, route, error: message });
        process.stderr.write(`failed ${contextConfig.label} ${route}: ${message}\n`);
      }
    }

    await context.close();
  }

  await browser.close();
  const manifestPath = path.join(RUN_DIR, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  process.stdout.write(`\nvisual export ready: ${path.relative(process.cwd(), RUN_DIR)}\n`);
  process.stdout.write(`manifest: ${path.relative(process.cwd(), manifestPath)}\n`);

  if (manifest.failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
