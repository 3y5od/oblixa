#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_INVENTORY_REL = "artifacts/supabase/sql-object-reference-inventory.json";
const SQL_DEFINITION_ROOTS = ["supabase/migrations"];
const SQL_REFERENCE_ROOTS = ["src", "supabase/tests"];
const EXTRA_SQL_REFERENCE_FILES = ["supabase/seed.sql"];
const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".sql"]);
const EXCLUDED_DIRS = new Set([".git", ".next", "artifacts", "coverage", "node_modules", "playwright-report", "test-results"]);
const SUPABASE_MANAGED_SCHEMAS = new Set(["auth", "extensions", "graphql", "graphql_public", "realtime", "storage", "supabase_migrations", "vault"]);
const MUTATING_METHOD_RE = /\.(?:insert|update|upsert|delete)\s*\(/u;
const NON_DATABASE_FROM_RECEIVERS = new Set([
  "Array",
  "Buffer",
  "Date",
  "JSON",
  "Map",
  "Number",
  "Object",
  "Promise",
  "Set",
  "String",
  "URL",
  "URLSearchParams",
  "console",
  "storage",
]);

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function walkFiles(root, dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) walkFiles(root, path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) acc.push(path.join(dir, entry.name));
  }
  return acc;
}

function listFiles(root, roots, extras = []) {
  const files = [];
  for (const rel of roots) walkFiles(root, path.join(root, rel), files);
  for (const rel of extras) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) files.push(abs);
  }
  return Array.from(new Set(files)).sort((a, b) => relPath(root, a).localeCompare(relPath(root, b)));
}

function addToSet(map, key, value) {
  const set = map.get(key) ?? new Set();
  set.add(value);
  map.set(key, set);
}

function sortedSet(set) {
  return Array.from(set ?? []).sort((a, b) => a.localeCompare(b));
}

function objectRef(schema, name) {
  return `${schema}.${name}`;
}

function pushDefinition(definitions, kind, schema, name, sourcePath) {
  if (!schema || !name) return;
  addToSet(definitions[kind], objectRef(schema, name), sourcePath);
}

function parseStorageBucketValues(sql, definitions, sourcePath) {
  for (const match of sql.matchAll(/insert\s+into\s+storage\.buckets[\s\S]{0,400}?values\s*\(([^)]*)\)/giu)) {
    const quoted = [...match[1].matchAll(/'([^']+)'/gu)].map((row) => row[1]);
    for (const bucket of quoted.slice(0, 2)) pushDefinition(definitions, "storageBuckets", "storage", bucket, sourcePath);
  }
}

function collectSqlDefinitionsFromText(sql, sourcePath) {
  const definitions = {
    tables: new Map(),
    views: new Map(),
    functions: new Map(),
    policies: new Map(),
    triggers: new Map(),
    storageBuckets: new Map(),
  };

  for (const match of sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/giu)) {
    pushDefinition(definitions, "tables", match[1], match[2], sourcePath);
  }
  for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/giu)) {
    pushDefinition(definitions, "views", match[1], match[2], sourcePath);
  }
  for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(/giu)) {
    pushDefinition(definitions, "functions", match[1], match[2], sourcePath);
  }
  for (const match of sql.matchAll(/\balter\s+function\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(/giu)) {
    pushDefinition(definitions, "functions", match[1], match[2], sourcePath);
  }
  for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?trigger\s+([a-z_][a-z0-9_]*)\s+[\s\S]{0,240}?\bon\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/giu)) {
    pushDefinition(definitions, "triggers", match[2], `${match[3]}:${match[1]}`, sourcePath);
  }
  for (const match of sql.matchAll(/\bcreate\s+policy\s+"([^"]+)"\s+on\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/giu)) {
    pushDefinition(definitions, "policies", match[2], `${match[3]}:${match[1]}`, sourcePath);
  }

  parseStorageBucketValues(sql, definitions, sourcePath);
  return definitions;
}

function mergeDefinitions(target, source) {
  for (const [kind, map] of Object.entries(source)) {
    for (const [key, values] of map.entries()) {
      for (const value of values) addToSet(target[kind], key, value);
    }
  }
}

export function collectSqlObjectDefinitions(root = DEFAULT_ROOT) {
  const definitions = {
    tables: new Map(),
    views: new Map(),
    functions: new Map(),
    policies: new Map(),
    triggers: new Map(),
    storageBuckets: new Map(),
  };
  const files = listFiles(root, SQL_DEFINITION_ROOTS, ["supabase/seed.sql"]);

  for (const abs of files) {
    const rel = relPath(root, abs);
    mergeDefinitions(definitions, collectSqlDefinitionsFromText(read(abs), rel));
  }

  return Object.fromEntries(
    Object.entries(definitions).map(([kind, map]) => [
      kind,
      Object.fromEntries(
        Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, sources]) => [key, sortedSet(sources)]),
      ),
    ]),
  );
}

function sourceLineForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/u).length;
}

function isInsideJsStringOrComment(text, index) {
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let cursor = 0; cursor < index; cursor += 1) {
    const char = text[cursor];
    const next = text[cursor + 1];

    if (lineComment) {
      if (char === "\n" || char === "\r") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        cursor += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      cursor += 1;
    } else if (char === "/" && next === "*") {
      blockComment = true;
      cursor += 1;
    } else if (char === "'" || char === "\"" || char === "`") {
      quote = char;
    }
  }

  return Boolean(quote || lineComment || blockComment);
}

function previousIdentifier(text, index) {
  const match = text.slice(0, index).replace(/\s+$/u, "").match(/([A-Za-z_$][\w$]*)$/u);
  return match?.[1] ?? "";
}

function shouldCountClientFromReference(text, index, sourcePath) {
  if (!sourcePath.endsWith(".sql") && isInsideJsStringOrComment(text, index)) return false;
  const receiver = previousIdentifier(text, index);
  return !NON_DATABASE_FROM_RECEIVERS.has(receiver);
}

function shouldCountSqlFunctionReference(text, index) {
  const prefix = text
    .slice(Math.max(0, index - 120), index)
    .toLowerCase()
    .replace(/\s+/gu, " ");
  return !/\b(?:insert\s+into|delete\s+from|update|from|join|references|alter\s+table|create\s+table|drop\s+table|on)\s+$/u.test(
    prefix,
  );
}

function addReference(refs, row) {
  refs.push({
    ...row,
    schema: row.schema ?? "public",
    object: row.object,
    ref: objectRef(row.schema ?? "public", row.object),
  });
}

function statementWindow(text, start) {
  const end = text.indexOf(";", start);
  return text.slice(start, end >= 0 ? end : Math.min(text.length, start + 500));
}

export function collectSqlObjectReferencesFromText({ text, sourcePath }) {
  const refs = [];

  for (const match of text.matchAll(/\.from\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*\)/gu)) {
    if (!shouldCountClientFromReference(text, match.index ?? 0, sourcePath)) continue;
    const window = statementWindow(text, match.index ?? 0);
    addReference(refs, {
      file: sourcePath,
      line: sourceLineForIndex(text, match.index ?? 0),
      kind: MUTATING_METHOD_RE.test(window) ? "write" : "read",
      objectType: "table_or_view",
      object: match[1],
    });
  }

  for (const match of text.matchAll(/\.rpc\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*/gu)) {
    addReference(refs, {
      file: sourcePath,
      line: sourceLineForIndex(text, match.index ?? 0),
      kind: "rpc",
      objectType: "function",
      object: match[1],
    });
  }

  for (const match of text.matchAll(/\.storage\s*\.from\(\s*["']([^"']+)["']\s*\)|\bstorage\.from\(\s*["']([^"']+)["']\s*\)/gu)) {
    addReference(refs, {
      file: sourcePath,
      line: sourceLineForIndex(text, match.index ?? 0),
      schema: "storage",
      kind: "storage",
      objectType: "storage_bucket",
      object: match[1] ?? match[2],
    });
  }

  if (sourcePath.endsWith(".sql")) {
    for (const match of text.matchAll(/\b(from|join)\s+public\.([a-z_][a-z0-9_]*)/giu)) {
      addReference(refs, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        kind: "read",
        objectType: "table_or_view",
        object: match[2],
      });
    }
    for (const match of text.matchAll(/\b(insert\s+into|update|delete\s+from)\s+public\.([a-z_][a-z0-9_]*)/giu)) {
      addReference(refs, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        kind: "write",
        objectType: "table_or_view",
        object: match[2],
      });
    }
    for (const match of text.matchAll(/\bpublic\.([a-z_][a-z0-9_]*)\s*\(/giu)) {
      if (!shouldCountSqlFunctionReference(text, match.index ?? 0)) continue;
      addReference(refs, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        kind: /^(is_|has_|can_|member_|role_)/u.test(match[1]) ? "policy_helper" : "rpc",
        objectType: "function",
        object: match[1],
      });
    }
    for (const match of text.matchAll(/\b(insert\s+into|update|delete\s+from)\s+storage\.buckets\b/giu)) {
      addReference(refs, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        schema: "storage",
        kind: "storage",
        objectType: "storage_bucket_catalog",
        object: "buckets",
      });
    }
    for (const match of text.matchAll(/\b(?:create|alter|drop)\s+policy\s+(?:"([^"]+)"|([a-z_][a-z0-9_]*))\s+on\s+public\.([a-z_][a-z0-9_]*)/giu)) {
      addReference(refs, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        kind: "policy",
        objectType: "policy",
        object: `${match[3]}:${match[1] ?? match[2]}`,
      });
    }
  }

  return refs;
}

export function collectSqlObjectReferences(root = DEFAULT_ROOT) {
  const files = listFiles(root, SQL_REFERENCE_ROOTS, EXTRA_SQL_REFERENCE_FILES);
  const references = [];
  for (const abs of files) {
    const rel = relPath(root, abs);
    references.push(...collectSqlObjectReferencesFromText({ text: read(abs), sourcePath: rel }));
  }
  return references.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.ref.localeCompare(b.ref));
}

function definitionHas(definitions, objectType, ref) {
  if (objectType === "function") return Boolean(definitions.functions?.[ref]);
  if (objectType === "policy") return Boolean(definitions.policies?.[ref]);
  if (objectType === "storage_bucket") return Boolean(definitions.storageBuckets?.[ref]);
  if (objectType === "storage_bucket_catalog") return ref === "storage.buckets";
  return Boolean(definitions.tables?.[ref] || definitions.views?.[ref]);
}

function compatibilitySensitive(ref) {
  return ref.schema === "public" || ref.objectType === "storage_bucket";
}

function summarizeReferences(references) {
  const byRef = new Map();
  for (const ref of references) {
    const row = byRef.get(ref.ref) ?? {
      ref: ref.ref,
      objectType: ref.objectType,
      kinds: new Set(),
      files: new Set(),
      compatibilitySensitive: compatibilitySensitive(ref),
    };
    row.kinds.add(ref.kind);
    row.files.add(ref.file);
    byRef.set(ref.ref, row);
  }
  return Array.from(byRef.values())
    .map((row) => ({
      ...row,
      kinds: sortedSet(row.kinds),
      files: sortedSet(row.files),
    }))
    .sort((a, b) => a.ref.localeCompare(b.ref));
}

export function buildSqlObjectReferenceInventory(root = DEFAULT_ROOT) {
  const definitions = collectSqlObjectDefinitions(root);
  const references = collectSqlObjectReferences(root);
  const missingReferences = references.filter(
    (ref) => !SUPABASE_MANAGED_SCHEMAS.has(ref.schema) && !definitionHas(definitions, ref.objectType, ref.ref),
  );

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-sql-object-reference-inventory.mjs --write",
    definitionSources: SQL_DEFINITION_ROOTS,
    referenceSources: [...SQL_REFERENCE_ROOTS, ...EXTRA_SQL_REFERENCE_FILES],
    definedObjects: definitions,
    referenceCount: references.length,
    references,
    referencedObjects: summarizeReferences(references),
    missingReferenceCount: missingReferences.length,
    missingReferences,
  };
}

function loadInventory(root, inventoryRel) {
  const abs = path.join(root, inventoryRel);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(read(abs));
}

export function analyzeSqlObjectReferenceInventory(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const inventoryRel = toPosix(options.inventoryRel ?? DEFAULT_INVENTORY_REL);
  const current = buildSqlObjectReferenceInventory(root);
  const committed = loadInventory(root, inventoryRel);
  const issues = [];

  if (!committed) {
    issues.push({ issue: "sql_object_reference_inventory_missing", path: inventoryRel });
  } else if (committed.schemaVersion !== 1) {
    issues.push({ issue: "invalid_sql_object_reference_inventory_schema", path: inventoryRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({
      issue: "sql_object_reference_inventory_drift",
      path: inventoryRel,
      hint: "Run npm run write:sql-object-reference-inventory",
    });
  }

  for (const ref of current.missingReferences) {
    issues.push({
      issue: "missing_sql_object_reference",
      file: ref.file,
      line: ref.line,
      ref: ref.ref,
      kind: ref.kind,
      objectType: ref.objectType,
    });
  }

  return {
    ok: issues.length === 0,
    inventoryPath: inventoryRel,
    referenceCount: current.referenceCount,
    referencedObjectCount: current.referencedObjects.length,
    missingReferenceCount: current.missingReferenceCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    inventoryRel: DEFAULT_INVENTORY_REL,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--inventory") {
      options.inventoryRel = toPosix(argv[index + 1] ?? DEFAULT_INVENTORY_REL);
      index += 1;
    } else if (arg.startsWith("--inventory=")) {
      options.inventoryRel = toPosix(arg.slice("--inventory=".length));
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

function writeInventory(root, inventoryRel) {
  const inventory = buildSqlObjectReferenceInventory(root);
  const abs = path.join(root, inventoryRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(inventory));
  return inventory;
}

export function runSqlObjectReferenceInventoryCheck(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const inventory = writeInventory(options.root, options.inventoryRel);
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.inventoryRel,
          referenceCount: inventory.referenceCount,
          referencedObjectCount: inventory.referencedObjects.length,
          missingReferenceCount: inventory.missingReferenceCount,
        },
        null,
        2,
      ),
    );
    if (inventory.missingReferenceCount > 0) process.exitCode = 1;
    return inventory;
  }

  const report = analyzeSqlObjectReferenceInventory(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlObjectReferenceInventoryCheck();
}
