#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/local-catalog-fingerprint.json";
const MIGRATIONS_REL = "supabase/migrations";

const SECTION_ORDER = [
  "tables",
  "columns",
  "constraints",
  "indexes",
  "policies",
  "functions",
  "views",
  "triggers",
  "extensions",
];

function toPosix(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

function normalizeSql(sql) {
  return String(sql)
    .replace(/--.*$/gmu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function listMigrationFiles(root) {
  const dir = path.join(root, MIGRATIONS_REL);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function makeEntry(kind, name, definition, sourcePath) {
  const normalizedDefinition = normalizeSql(definition);
  return {
    kind,
    name,
    fingerprint: sha256Text(`${kind}:${name}:${normalizedDefinition}`),
    sourcePath,
  };
}

function addEntry(sections, kind, name, definition, sourcePath) {
  if (!name) return;
  sections[kind].push(makeEntry(kind, name.replace(/"/gu, ""), definition, sourcePath));
}

function splitCreateTableColumns(body) {
  const columns = [];
  let depth = 0;
  let current = "";
  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      columns.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) columns.push(current.trim());
  return columns;
}

function scanCreateTableColumns(sections, tableName, body, sourcePath) {
  for (const columnDef of splitCreateTableColumns(body)) {
    const firstToken = columnDef.trim().split(/\s+/u)[0]?.replace(/"/gu, "");
    if (!firstToken) continue;
    if (/^(?:constraint|primary|foreign|unique|check|exclude)$/iu.test(firstToken)) {
      const constraintName = /constraint\s+"?([a-z0-9_]+)"?/iu.exec(columnDef)?.[1] ?? `${tableName}:${normalizeSql(columnDef).slice(0, 80)}`;
      addEntry(sections, "constraints", `public.${tableName}.${constraintName}`, columnDef, sourcePath);
      continue;
    }
    addEntry(sections, "columns", `public.${tableName}.${firstToken}`, columnDef, sourcePath);
  }
}

export function scanSupabaseCatalogFingerprint(root = DEFAULT_ROOT) {
  const sections = Object.fromEntries(SECTION_ORDER.map((section) => [section, []]));
  const migrations = listMigrationFiles(root);

  for (const file of migrations) {
    const sourcePath = `${MIGRATIONS_REL}/${file}`;
    const sql = fs.readFileSync(path.join(root, MIGRATIONS_REL, file), "utf8");

    for (const match of sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?"?public"?\."?([a-z0-9_]+)"?\s*\(([\s\S]*?)\)\s*;/giu)) {
      const tableName = match[1];
      addEntry(sections, "tables", `public.${tableName}`, match[0], sourcePath);
      scanCreateTableColumns(sections, tableName, match[2], sourcePath);
    }

    for (const match of sql.matchAll(/\balter\s+table\s+(?:only\s+)?"?public"?\."?([a-z0-9_]+)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?([^;]*);/giu)) {
      addEntry(sections, "columns", `public.${match[1]}.${match[2]}`, match[0], sourcePath);
    }

    for (const match of sql.matchAll(/\balter\s+table\s+(?:only\s+)?"?public"?\."?([a-z0-9_]+)"?\s+add\s+(?:constraint\s+"?([a-z0-9_]+)"?)?([^;]*);/giu)) {
      const tail = match[3] ?? "";
      if (!/\b(?:primary\s+key|foreign\s+key|unique|check|exclude)\b/iu.test(tail)) continue;
      const name = match[2] ?? `${match[1]}:${normalizeSql(tail).slice(0, 80)}`;
      addEntry(sections, "constraints", `public.${match[1]}.${name}`, match[0], sourcePath);
    }

    for (const match of sql.matchAll(/\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?\s+on\s+"?public"?\."?([a-z0-9_]+)"?([^;]*);/giu)) {
      addEntry(sections, "indexes", `public.${match[2]}.${match[1]}`, match[0], sourcePath);
    }

    for (const match of sql.matchAll(/\bcreate\s+policy\s+"?([^"\n]+?)"?\s+on\s+"?public"?\."?([a-z0-9_]+)"?([^;]*);/giu)) {
      addEntry(sections, "policies", `public.${match[2]}.${match[1].trim()}`, match[0], sourcePath);
    }

    for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+"?public"?\."?([a-z0-9_]+)"?\s*\(([\s\S]*?)\)\s+returns\b[\s\S]*?(?:\$\$|;)/giu)) {
      addEntry(sections, "functions", `public.${match[1]}(${normalizeSql(match[2])})`, match[0], sourcePath);
    }

    for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:security\s+invoker\s+)?view\s+"?public"?\."?([a-z0-9_]+)"?\s+as\s+[\s\S]*?;/giu)) {
      addEntry(sections, "views", `public.${match[1]}`, match[0], sourcePath);
    }

    for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?trigger\s+"?([a-z0-9_]+)"?\s+[\s\S]*?\s+on\s+"?public"?\."?([a-z0-9_]+)"?[\s\S]*?;/giu)) {
      addEntry(sections, "triggers", `public.${match[2]}.${match[1]}`, match[0], sourcePath);
    }

    for (const match of sql.matchAll(/\bcreate\s+extension\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_-]+)"?([^;]*);/giu)) {
      addEntry(sections, "extensions", match[1], match[0], sourcePath);
    }
  }

  return {
    migrationFiles: migrations,
    sections: Object.fromEntries(
      SECTION_ORDER.map((section) => [
        section,
        sections[section].sort((a, b) => a.name.localeCompare(b.name) || a.sourcePath.localeCompare(b.sourcePath)),
      ]),
    ),
  };
}

function sectionSummary(entries) {
  const names = entries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
  const fingerprint = sha256Text(entries.map((entry) => `${entry.name}:${entry.fingerprint}`).join("\n"));
  return {
    count: entries.length,
    fingerprint,
    names,
    items: entries.map((entry) => ({
      name: entry.name,
      fingerprint: entry.fingerprint,
      sourcePath: entry.sourcePath,
    })),
  };
}

export function buildSupabaseFingerprintArtifact(root = DEFAULT_ROOT) {
  const scan = scanSupabaseCatalogFingerprint(root);
  const latestMigration = scan.migrationFiles.at(-1) ?? null;
  const migrationRollupSha256 = sha256Text(
    scan.migrationFiles
      .map((file) => {
        const sql = fs.readFileSync(path.join(root, MIGRATIONS_REL, file), "utf8");
        return `${file}:${sha256Text(sql)}`;
      })
      .join("\n"),
  );

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-supabase-fingerprint-artifact.mjs --write",
    sourceDirectory: MIGRATIONS_REL,
    migrationCount: scan.migrationFiles.length,
    latestMigration,
    migrationRollupSha256,
    sectionOrder: SECTION_ORDER,
    sections: Object.fromEntries(SECTION_ORDER.map((section) => [section, sectionSummary(scan.sections[section])])),
  };
}

function loadArtifact(root, artifactRel) {
  return JSON.parse(fs.readFileSync(path.join(root, artifactRel), "utf8"));
}

function compareSections(expected, actual) {
  const findings = [];
  for (const section of SECTION_ORDER) {
    const expectedItems = new Map((expected.sections?.[section]?.items ?? []).map((entry) => [entry.name, entry]));
    const actualItems = new Map((actual.sections?.[section]?.items ?? []).map((entry) => [entry.name, entry]));
    for (const [name, entry] of expectedItems) {
      const current = actualItems.get(name);
      if (!current) {
        findings.push({ issue: "missing_object", section, name, sourcePath: entry.sourcePath });
      } else if (current.fingerprint !== entry.fingerprint) {
        findings.push({
          issue: "changed_definition",
          section,
          name,
          expectedFingerprint: entry.fingerprint,
          actualFingerprint: current.fingerprint,
          sourcePath: entry.sourcePath,
        });
      }
    }
    for (const [name, entry] of actualItems) {
      if (!expectedItems.has(name)) {
        findings.push({ issue: "unexpected_object", section, name, sourcePath: entry.sourcePath });
      }
    }
  }
  return findings.sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
}

function remediationFor(finding) {
  if (finding.issue === "missing_object") {
    return `Review whether ${finding.section} ${finding.name} was removed intentionally and add a forward migration or refresh the fingerprint artifact.`;
  }
  if (finding.issue === "unexpected_object") {
    return `Review newly detected ${finding.section} ${finding.name} and refresh the fingerprint artifact after migration review.`;
  }
  return `Review definition drift for ${finding.section} ${finding.name} and confirm the migration or artifact refresh path.`;
}

export function analyzeSupabaseFingerprintArtifact(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = toPosix(options.artifactRel ?? DEFAULT_ARTIFACT_REL);
  const expected = buildSupabaseFingerprintArtifact(root);
  const issues = [];
  let actual = null;

  try {
    actual = loadArtifact(root, artifactRel);
  } catch (error) {
    return {
      ok: false,
      artifactPath: artifactRel,
      issueCount: 1,
      issues: [{ issue: "fingerprint_artifact_unreadable", path: artifactRel, message: error.message }],
      current: expected,
      driftFindings: [],
      remediationQueue: [],
    };
  }

  if (stableStringify(actual) !== stableStringify(expected)) {
    issues.push({ issue: "fingerprint_artifact_drift", path: artifactRel, hint: "Run npm run write:supabase:fingerprint-artifact" });
  }

  const driftFindings = compareSections(actual, expected);
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    migrationCount: expected.migrationCount,
    latestMigration: expected.latestMigration,
    sectionCounts: Object.fromEntries(SECTION_ORDER.map((section) => [section, expected.sections[section].count])),
    issueCount: issues.length,
    issues,
    driftFindings,
    remediationQueue: driftFindings.map((finding) => ({
      section: finding.section,
      name: finding.name,
      action: remediationFor(finding),
    })),
    current: expected,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false, report: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = toPosix(argv[index + 1] ?? DEFAULT_ARTIFACT_REL);
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = toPosix(arg.slice("--artifact=".length));
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--report") {
      options.report = true;
    }
  }
  return options;
}

export function runSupabaseFingerprintArtifactCheck(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildSupabaseFingerprintArtifact(options.root);
    const artifactPath = path.join(options.root, options.artifactRel);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(artifact));
    console.log(JSON.stringify({ ok: true, wrote: options.artifactRel, migrationCount: artifact.migrationCount, latestMigration: artifact.latestMigration }, null, 2));
    return artifact;
  }

  const report = analyzeSupabaseFingerprintArtifact(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok && !options.report) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseFingerprintArtifactCheck();
}
