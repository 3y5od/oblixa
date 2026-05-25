#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const CLIENT_STORAGE_HELPER = "src/lib/security/client-storage.ts";
const SENSITIVE_STORAGE_TOKEN =
  /token|secret|password|credential|cookie|session|jwt|bearer|authorization|signed.?url|service.?role|api.?key|provider.?payload|raw.?document|document.?text|contract.?text|file.?bytes/i;
const REQUIRED_HELPER_MARKERS = [
  "CLIENT_STORAGE_JSON_MAX_LENGTH",
  "hasUnsafeJsonKey(parsed)",
  "isJsonShapeWithinLimits(parsed",
  "export function readCommandPaletteRecentCommands()",
  "export function readUploadMetadataDraft(",
  "export function writeContractTableSelection(",
  "export function clearUploadMetadataDraft(",
];
const APPROVED_STORAGE_KEYS = [
  {
    storage: "localStorage",
    pattern: /^oblixa\.sidebar\.collapsed$/,
    dataClass: "ui_preference",
  },
  {
    storage: "localStorage",
    pattern: /^oblixa\.contracts\.reviewQueueStartGuide\.dismissed$/,
    dataClass: "ui_preference",
  },
  {
    storage: "localStorage",
    pattern: /^oblixa\.command-palette\.recent$/,
    dataClass: "navigation_history",
  },
  {
    storage: "localStorage",
    pattern: /^oblixa\.dashboard\.collapsed\.\$\{value\}$/,
    dataClass: "ui_preference",
  },
  {
    storage: "localStorage",
    pattern: /^oblixa\.dashboard\.section-order$/,
    dataClass: "ui_preference",
  },
  {
    storage: "localStorage",
    pattern: /^oblixa\.dashboard\.section-order:\$\{value\}$/,
    dataClass: "ui_preference",
  },
  {
    storage: "sessionStorage",
    pattern: /^oblixa-product-mobile-cta-dismissed$/,
    dataClass: "ui_preference",
  },
  {
    storage: "sessionStorage",
    pattern: /^oblixa\.contract-table\.selection:\$\{value\}$/,
    dataClass: "ephemeral_contract_selection",
  },
  {
    storage: "sessionStorage",
    pattern: /^oblixa\.uploadDraft\.v1:\$\{value\}$/,
    dataClass: "metadata_draft_no_file_bytes",
  },
  {
    storage: "localStorage",
    pattern: /^oblixa\.table-density:\$\{value\}$/,
    dataClass: "ui_preference",
  },
  {
    storage: "localStorage",
    pattern: /^oblixa\.recent:\$\{value\}$/,
    dataClass: "navigation_history",
  },
];

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function isSourceFile(name) {
  return SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isTestFile(rel) {
  return /\.(test|spec|ui\.test)\.(ts|tsx|js|jsx)$/.test(rel) || rel.startsWith("src/test-utils/");
}

function walk(dir, root, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, root, acc);
    else if (isSourceFile(name)) acc.push(toPosix(path.relative(root, abs)));
  }
  return acc;
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function splitTopLevelArgs(argsSource) {
  const args = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = 0; i < argsSource.length; i += 1) {
    const ch = argsSource[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      args.push(argsSource.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(argsSource.slice(start).trim());
  return args.filter(Boolean);
}

function collectStorageCalls(source) {
  const calls = [];
  const storageRe = /\b(?:window\.)?(localStorage|sessionStorage)\.(getItem|setItem|removeItem)\s*\(/g;
  let match;
  while ((match = storageRe.exec(source)) !== null) {
    const argsStart = storageRe.lastIndex;
    let quote = null;
    let escaped = false;
    let depth = 1;
    let i = argsStart;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === quote) {
          quote = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue;
    const args = splitTopLevelArgs(source.slice(argsStart, i));
    calls.push({
      storage: match[1],
      method: match[2],
      args,
      line: lineForOffset(source, match.index),
    });
    storageRe.lastIndex = i + 1;
  }
  return calls;
}

function resolveLocalSpecifier(fromRel, specifier, root) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;
  const baseRel = specifier.startsWith("@/")
    ? path.join("src", specifier.slice(2))
    : path.join(path.dirname(fromRel), specifier);
  const normalized = toPosix(baseRel);
  const candidates = [
    normalized,
    ...SOURCE_EXTENSIONS.map((ext) => `${normalized}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => `${normalized}/index${ext}`),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(root, candidate))) ?? null;
}

function normalizeTemplateLiteral(expr) {
  return expr.slice(1, -1).replace(/\$\{[^}]+\}/g, "${value}");
}

function pickConditionalKeyExpression(expr) {
  let quote = null;
  let escaped = false;
  let depth = 0;
  let questionIndex = -1;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "?" && depth === 0) questionIndex = i;
    else if (ch === ":" && depth === 0 && questionIndex >= 0) {
      const left = expr.slice(questionIndex + 1, i).trim();
      const right = expr.slice(i + 1).trim();
      if (right === "null" || right === "undefined") return left;
      if (left === "null" || left === "undefined") return right;
      return expr;
    }
  }
  return expr;
}

function findConstExpression(source, name) {
  const re = new RegExp(`(?:export\\s+)?const\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*([^;\\n]+)`, "m");
  return re.exec(source)?.[1]?.trim() ?? null;
}

function findReturnedExpression(source, name) {
  const re = new RegExp(`function\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?return\\s+([^;]+);[\\s\\S]*?\\}`, "m");
  return re.exec(source)?.[1]?.trim() ?? null;
}

function findImportedConstExpression(root, fromRel, source, name) {
  const importRe = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = importRe.exec(source)) !== null) {
    const importedNames = match[1].split(",").map((part) => part.trim().split(/\s+as\s+/).pop()?.trim());
    if (!importedNames.includes(name)) continue;
    const target = resolveLocalSpecifier(fromRel, match[2], root);
    if (!target) continue;
    return findConstExpression(read(root, target), name);
  }
  return null;
}

function resolveKeyExpression(root, rel, source, expr, seen = new Set()) {
  const trimmed = pickConditionalKeyExpression(expr.trim());
  const literal = /^["']([^"']+)["']$/.exec(trimmed);
  if (literal) return { resolved: true, key: literal[1] };
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return { resolved: true, key: normalizeTemplateLiteral(trimmed) };
  }
  const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(trimmed);
  if (call) {
    const returned = findReturnedExpression(source, call[1]);
    if (returned) return resolveKeyExpression(root, rel, source, returned, seen);
  }
  if (/^[A-Za-z_$][\w$]*$/.test(trimmed) && !seen.has(trimmed)) {
    seen.add(trimmed);
    const local = findConstExpression(source, trimmed);
    if (local) return resolveKeyExpression(root, rel, source, local, seen);
    const imported = findImportedConstExpression(root, rel, source, trimmed);
    if (imported) return resolveKeyExpression(root, rel, source, imported, seen);
  }
  return { resolved: false, key: trimmed };
}

function approvedStorageKey(storage, key) {
  return APPROVED_STORAGE_KEYS.find((entry) => entry.storage === storage && entry.pattern.test(key)) ?? null;
}

export function analyzeClientStorageSensitivity(root = ROOT) {
  const issues = [];
  const helperPath = path.join(root, CLIENT_STORAGE_HELPER);
  if (!fs.existsSync(helperPath)) {
    issues.push({ issue: "missing_client_storage_helper", rel: CLIENT_STORAGE_HELPER });
  } else {
    const helperSource = read(root, CLIENT_STORAGE_HELPER);
    for (const marker of REQUIRED_HELPER_MARKERS) {
      if (!helperSource.includes(marker)) {
        issues.push({ issue: "missing_client_storage_helper_marker", rel: CLIENT_STORAGE_HELPER, marker });
      }
    }
  }

  const srcRoot = path.join(root, "src");
  const files = walk(srcRoot, root).filter((rel) => !isTestFile(rel)).sort();

  for (const rel of files) {
    const source = read(root, rel);
    for (const call of collectStorageCalls(source)) {
      const keyArg = call.args[0] ?? "";
      const key = resolveKeyExpression(root, rel, source, keyArg);
      const base = { rel, line: call.line, storage: call.storage, method: call.method, keyExpression: keyArg };
      if (rel !== CLIENT_STORAGE_HELPER) {
        issues.push({ issue: "direct_client_storage_access", ...base });
      }
      if (rel === CLIENT_STORAGE_HELPER && !key.resolved) {
        continue;
      }
      if (!key.resolved) {
        issues.push({ issue: "unresolved_storage_key", ...base });
        continue;
      }
      if (SENSITIVE_STORAGE_TOKEN.test(key.key)) {
        issues.push({ issue: "sensitive_storage_key", ...base, key: key.key });
      }
      if (!approvedStorageKey(call.storage, key.key)) {
        issues.push({ issue: "unapproved_storage_key", ...base, key: key.key });
      }
      if (call.method === "setItem" && SENSITIVE_STORAGE_TOKEN.test(call.args[1] ?? "")) {
        issues.push({ issue: "sensitive_storage_value", ...base, key: key.key, valueExpression: call.args[1] });
      }
    }
  }

  return {
    checkId: "client-storage-sensitivity",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeClientStorageSensitivity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
