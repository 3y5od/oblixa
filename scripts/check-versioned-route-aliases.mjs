#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const API_ROOT_REL = "src/app/api";

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, acc);
      continue;
    }
    if (entry.isFile()) acc.push(abs);
  }
  return acc;
}

function routeAliasSource(legacyImport) {
  return `export * from "${legacyImport}";\n`;
}

function routeAliasTestSource(legacyImport) {
  return [
    'import { describe, expect, it } from "vitest";',
    'import fs from "node:fs";',
    'import path from "node:path";',
    'import { fileURLToPath } from "node:url";',
    "",
    'describe("versioned route compatibility alias", () => {',
    '  it("re-exports the legacy handler without duplicating route logic", () => {',
    "    const currentDir = path.dirname(fileURLToPath(import.meta.url));",
    '    const source = fs.readFileSync(path.join(currentDir, "route.ts"), "utf8");',
    `    expect(source).toBe('export * from "${legacyImport}";\\n');`,
    "  });",
    "});",
    "",
  ].join("\n");
}

function cronAliasRows(root) {
  const cronRoot = path.join(root, API_ROOT_REL, "cron");
  return walkFiles(cronRoot)
    .map((abs) => relPath(root, abs))
    .filter((rel) => /^src\/app\/api\/cron\/v(?:4|5|6|10)\/[^/]+\/route\.ts$/u.test(rel))
    .map((legacyRouteFile) => {
      const [, version, job] = legacyRouteFile.match(/^src\/app\/api\/cron\/(v(?:4|5|6|10))\/([^/]+)\/route\.ts$/u);
      return {
        surface: "cron_route",
        legacyRouteFile,
        neutralRouteFile: `src/app/api/cron/${job}/route.ts`,
        legacyPath: `/api/cron/${version}/${job}`,
        neutralPath: `/api/cron/${job}`,
        legacyImport: `../${version}/${job}/route`,
        owner: "platform-api",
        reason: "Neutral cron route alias preserves compatibility while Vercel schedules continue to call legacy paths.",
      };
    });
}

function workspaceAliasRows(root) {
  const legacyRouteFile = "src/app/api/workspace/v6-settings/route.ts";
  if (!fs.existsSync(path.join(root, legacyRouteFile))) return [];
  return [
    {
      surface: "api_route",
      legacyRouteFile,
      neutralRouteFile: "src/app/api/workspace/settings/route.ts",
      legacyPath: "/api/workspace/v6-settings",
      neutralPath: "/api/workspace/settings",
      legacyImport: "../v6-settings/route",
      owner: "platform-api",
      reason: "Neutral workspace settings alias keeps the legacy route callable during client and external reference migration.",
    },
  ];
}

export function buildVersionedRouteAliasPlan(root = DEFAULT_ROOT) {
  return [...cronAliasRows(root), ...workspaceAliasRows(root)].sort((a, b) =>
    a.neutralRouteFile.localeCompare(b.neutralRouteFile),
  );
}

function expectedFiles(row) {
  return [
    {
      path: row.neutralRouteFile,
      content: routeAliasSource(row.legacyImport),
    },
    {
      path: row.neutralRouteFile.replace(/route\.ts$/u, "route.test.ts"),
      content: routeAliasTestSource(row.legacyImport),
    },
  ];
}

export function analyzeVersionedRouteAliases(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const aliases = buildVersionedRouteAliasPlan(root);
  const issues = [];

  for (const row of aliases) {
    for (const file of expectedFiles(row)) {
      const abs = path.join(root, file.path);
      if (!fs.existsSync(abs)) {
        issues.push({ issue: "versioned_route_alias_file_missing", path: file.path, legacyRouteFile: row.legacyRouteFile });
        continue;
      }
      const actual = fs.readFileSync(abs, "utf8");
      if (actual !== file.content) {
        issues.push({ issue: "versioned_route_alias_file_drift", path: file.path, legacyRouteFile: row.legacyRouteFile });
      }
    }
  }

  return {
    ok: issues.length === 0,
    aliasCount: aliases.length,
    issueCount: issues.length,
    issues,
    aliases,
  };
}

export function writeVersionedRouteAliases(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const aliases = buildVersionedRouteAliasPlan(root);
  const changedFiles = [];
  for (const row of aliases) {
    for (const file of expectedFiles(row)) {
      const abs = path.join(root, file.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const before = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
      if (before === file.content) continue;
      fs.writeFileSync(abs, file.content);
      changedFiles.push(file.path);
    }
  }
  return {
    ...analyzeVersionedRouteAliases({ root }),
    mode: "write",
    changedFiles: changedFiles.sort((a, b) => a.localeCompare(b)),
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runVersionedRouteAliases(options = parseArgs(process.argv.slice(2))) {
  const report = options.write ? writeVersionedRouteAliases(options) : analyzeVersionedRouteAliases(options);
  const { aliases, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedRouteAliases();
}
