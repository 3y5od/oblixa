import fs from "node:fs";
import path from "node:path";

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function resolveInternalImport(root, fromRel, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  const fromDir = path.dirname(path.join(root, fromRel));
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(fromDir, specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return toPosix(path.relative(root, candidate));
    }
  }
  return null;
}

function collectInternalImportGraph(root, entryRel, seen = new Set()) {
  if (seen.has(entryRel) || !exists(root, entryRel)) return seen;
  seen.add(entryRel);
  const source = read(root, entryRel);
  const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(importRe)) {
    const resolved = resolveInternalImport(root, entryRel, match[1]);
    if (resolved) collectInternalImportGraph(root, resolved, seen);
  }
  return seen;
}

export function readAuthActionImplementationSource(root, actionRel = "src/actions/auth.ts") {
  return [...collectInternalImportGraph(root, actionRel)]
    .filter((rel) => rel === actionRel || rel.startsWith("src/lib/auth/"))
    .map((rel) => read(root, rel))
    .join("\n");
}

export function readSourceWithSupplements(root, rel, supplements = []) {
  return [rel, ...supplements.filter((supplementRel) => exists(root, supplementRel))]
    .map((sourceRel) => read(root, sourceRel))
    .join("\n");
}
