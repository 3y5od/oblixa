#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC_ROOT_REL = "src";
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const ALLOWED_CLIENT_ENV_KEYS = new Set(["NODE_ENV"]);
const FORBIDDEN_PUBLIC_ENV_TOKENS = /SECRET|SERVICE_ROLE|PRIVATE|TOKEN|PASSWORD|API_KEY|WEBHOOK/i;

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function isSourceFile(name) {
  return SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isTestFile(rel) {
  return /\.(test|spec|ui\.test)\.(ts|tsx|js|jsx)$/.test(rel);
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

function stripLeadingTrivia(source) {
  let rest = source.replace(/^\uFEFF/, "");
  for (;;) {
    const trimmed = rest.replace(/^\s+/, "");
    if (trimmed !== rest) {
      rest = trimmed;
      continue;
    }
    if (rest.startsWith("//")) {
      const newlineIndex = rest.indexOf("\n");
      rest = newlineIndex === -1 ? "" : rest.slice(newlineIndex + 1);
      continue;
    }
    if (rest.startsWith("/*")) {
      const commentEndIndex = rest.indexOf("*/");
      rest = commentEndIndex === -1 ? "" : rest.slice(commentEndIndex + 2);
      continue;
    }
    return rest;
  }
}

function hasModuleDirective(source, directive) {
  let rest = source;
  for (;;) {
    rest = stripLeadingTrivia(rest);
    const match = /^(["'])([^"']+)\1\s*;?/.exec(rest);
    if (!match) return false;
    if (match[2] === directive) return true;
    rest = rest.slice(match[0].length);
  }
}

function hasUseClientDirective(source) {
  return hasModuleDirective(source, "use client");
}

function hasUseServerDirective(source) {
  return hasModuleDirective(source, "use server");
}

function resolveLocalSpecifier(fromRel, specifier) {
  let baseRel;
  if (specifier.startsWith("@/")) {
    baseRel = path.join("src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    baseRel = path.join(path.dirname(fromRel), specifier);
  } else {
    return null;
  }

  const normalized = toPosix(baseRel);
  const candidates = [
    normalized,
    ...SOURCE_EXTENSIONS.map((ext) => `${normalized}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => `${normalized}/index${ext}`),
  ];
  return candidates;
}

function collectImportSpecifiers(source) {
  const imports = [];
  const importRe = /^\s*import\s+(type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/gm;
  const exportRe = /^\s*export\s+(type\s+)?[^"']*?\s+from\s+["']([^"']+)["']/gm;
  for (const re of [importRe, exportRe]) {
    let match;
    while ((match = re.exec(source)) !== null) {
      imports.push({ specifier: match[2], typeOnly: Boolean(match[1]) });
    }
  }
  return imports;
}

function buildModuleIndex(root) {
  const srcRoot = path.join(root, SRC_ROOT_REL);
  const files = walk(srcRoot, root).filter((rel) => !isTestFile(rel)).sort();
  const modules = new Map();
  for (const rel of files) {
    modules.set(rel, read(root, rel));
  }
  return modules;
}

function buildClientReachableGraph(root, modules) {
  const moduleSet = new Set(modules.keys());
  const roots = [...modules.entries()]
    .filter(([, source]) => hasUseClientDirective(source))
    .map(([rel]) => rel)
    .sort();
  const reachable = new Map();
  const serverBoundaries = new Map();
  const queue = roots.map((rel) => ({ rel, chain: [rel] }));

  while (queue.length) {
    const next = queue.shift();
    if (!next || reachable.has(next.rel)) continue;
    const source = modules.get(next.rel);
    if (!source) continue;
    reachable.set(next.rel, next.chain);
    if (hasUseServerDirective(source)) {
      serverBoundaries.set(next.rel, next.chain);
      continue;
    }
    for (const imported of collectImportSpecifiers(source)) {
      if (imported.typeOnly) continue;
      const candidates = resolveLocalSpecifier(next.rel, imported.specifier);
      if (!candidates) continue;
      const target = candidates.find((candidate) => moduleSet.has(candidate));
      if (target && !reachable.has(target)) {
        queue.push({ rel: target, chain: [...next.chain, target] });
      }
    }
  }

  return { roots, reachable, serverBoundaries };
}

function collectEnvIssues(rel, chain, source) {
  const issues = [];
  const dotEnvRe = /\bprocess\.env\.([A-Z0-9_]+)\b/g;
  const bracketEnvRe = /\bprocess\.env\[\s*["']([A-Z0-9_]+)["']\s*\]/g;
  const dynamicEnvRe = /\bprocess\.env\[\s*(?!["'])/g;
  for (const re of [dotEnvRe, bracketEnvRe]) {
    let match;
    while ((match = re.exec(source)) !== null) {
      const key = match[1];
      if (key.startsWith("NEXT_PUBLIC_")) {
        if (FORBIDDEN_PUBLIC_ENV_TOKENS.test(key.replace(/^NEXT_PUBLIC_/, ""))) {
          issues.push({ issue: "sensitive_next_public_env", rel, key, chain });
        }
        continue;
      }
      if (ALLOWED_CLIENT_ENV_KEYS.has(key)) continue;
      issues.push({ issue: "server_env_in_client_bundle", rel, key, chain });
    }
  }
  if (dynamicEnvRe.test(source)) {
    issues.push({ issue: "dynamic_env_lookup_in_client_bundle", rel, chain });
  }
  return issues;
}

function collectServerOnlyIssues(rel, chain, source) {
  const issues = [];
  for (const imported of collectImportSpecifiers(source)) {
    if (imported.typeOnly) continue;
    if (imported.specifier === "server-only") {
      issues.push({ issue: "server_only_import_in_client_bundle", rel, specifier: imported.specifier, chain });
    }
    if (imported.specifier === "@/lib/supabase/server" || imported.specifier.endsWith("/lib/supabase/server")) {
      issues.push({ issue: "supabase_server_import_in_client_bundle", rel, specifier: imported.specifier, chain });
    }
  }
  if (/\bcreateAdminClient\s*\(/.test(source)) {
    issues.push({ issue: "service_role_call_in_client_bundle", rel, symbol: "createAdminClient", chain });
  }
  return issues;
}

export function analyzeClientBundleSecretLeakage(root = ROOT) {
  const modules = buildModuleIndex(root);
  const { roots, reachable, serverBoundaries } = buildClientReachableGraph(root, modules);
  const issues = [];

  for (const [rel, chain] of reachable.entries()) {
    if (serverBoundaries.has(rel)) continue;
    const source = modules.get(rel) ?? "";
    issues.push(...collectEnvIssues(rel, chain, source));
    issues.push(...collectServerOnlyIssues(rel, chain, source));
  }

  return {
    checkId: "client-bundle-secret-leakage",
    ok: issues.length === 0,
    clientRootCount: roots.length,
    clientReachableModuleCount: reachable.size,
    serverBoundaryCount: serverBoundaries.size,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeClientBundleSecretLeakage();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
