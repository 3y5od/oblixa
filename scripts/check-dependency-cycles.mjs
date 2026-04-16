#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const srcRoot = path.join(root, "src");

const files = walkFiles(srcRoot, (abs) => /\.(ts|tsx)$/.test(abs));
const graph = new Map();

function normalizeImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  if (!hit) return null;
  return path.relative(srcRoot, hit).replace(/\\/g, "/");
}

for (const file of files) {
  const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");
  const imports = [];
  for (const match of content.matchAll(/from\s+["']([^"']+)["']/g)) {
    const target = normalizeImport(file, match[1]);
    if (target) imports.push(target);
  }
  graph.set(rel, imports);
}

const visiting = new Set();
const visited = new Set();
const cycles = [];

function dfs(node, stack = []) {
  if (visiting.has(node)) {
    const idx = stack.indexOf(node);
    cycles.push([...stack.slice(idx), node]);
    return;
  }
  if (visited.has(node)) return;
  visiting.add(node);
  for (const next of graph.get(node) || []) dfs(next, [...stack, node]);
  visiting.delete(node);
  visited.add(node);
}

for (const node of graph.keys()) dfs(node);

const payload = { checkId: "dependency-cycles", strict, ok: !strict || cycles.length === 0, cycleCount: cycles.length, cycles: cycles.slice(0, 30) };
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
