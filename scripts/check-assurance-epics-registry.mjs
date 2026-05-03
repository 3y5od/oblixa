#!/usr/bin/env node
/** Epic 96 — epics.json sync vs vendored plan todos (176 rows). */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const planPath = path.join(root, "artifacts", "assurance", "maximal-assurance-program.plan.md");
const registryPath = path.join(root, "artifacts", "assurance", "epics.json");

function extractFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) {
    throw new Error("artifacts/assurance/maximal-assurance-program.plan.md: missing YAML frontmatter");
  }
  return m[1];
}

function parseEpicsInline(text) {
  const yamlPart = extractFrontmatter(text);
  const todosIdx = yamlPart.indexOf("\ntodos:\n");
  if (todosIdx === -1) throw new Error("missing todos:");
  const afterTodos = yamlPart.slice(todosIdx);
  const re = /^  - id: ([^\n]+)\n    content: "([^"]*)"\n    status: ([^\n]+)/gm;
  const keys = [];
  let m;
  while ((m = re.exec(afterTodos)) !== null) {
    keys.push(m[1].trim());
  }
  return keys;
}

const planText = fs.readFileSync(planPath, "utf8");
const planKeys = parseEpicsInline(planText);
if (planKeys.length !== 176) {
  console.error(`Plan todos parse count ${planKeys.length}, expected 176`);
  process.exit(1);
}

const committed = JSON.parse(fs.readFileSync(registryPath, "utf8"));
if (committed.expectedEpicCount !== 176 || committed.epics?.length !== 176) {
  console.error("epics.json expectedEpicCount/epics.length must be 176");
  process.exit(1);
}

const regKeys = committed.epics.map((e) => e.todoKey);
if (JSON.stringify(regKeys) !== JSON.stringify(planKeys)) {
  console.error("epics.json todoKey ordering differs from maximal-assurance-program.plan.md todos.");
  process.exit(1);
}

console.log("OK: epics.json registry matches vendored plan (176 epics).");
