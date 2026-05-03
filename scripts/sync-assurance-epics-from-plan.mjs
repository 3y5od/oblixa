#!/usr/bin/env node
/**
 * Epic 96 — Regenerate artifacts/assurance/epics.json from vendored plan frontmatter todos.
 * Usage: node scripts/sync-assurance-epics-from-plan.mjs --write
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const planPath = path.join(root, "artifacts", "assurance", "maximal-assurance-program.plan.md");
const outPath = path.join(root, "artifacts", "assurance", "epics.json");

function extractFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) {
    throw new Error("artifacts/assurance/maximal-assurance-program.plan.md: missing YAML frontmatter");
  }
  return m[1];
}

function parseEpics(text) {
  const yamlPart = extractFrontmatter(text);
  const todosIdx = yamlPart.indexOf("\ntodos:\n");
  if (todosIdx === -1) throw new Error("maximal-assurance-program.plan.md: missing todos: block in frontmatter");
  const afterTodos = yamlPart.slice(todosIdx);
  const re = /^  - id: ([^\n]+)\n    content: "([^"]*)"\n    status: ([^\n]+)/gm;
  const epics = [];
  let m;
  while ((m = re.exec(afterTodos)) !== null) {
    const id = m[1].trim();
    const content = m[2];
    const status = m[3].trim();
    const numMatch = /^Epic\s+(\d+)\s*:/i.exec(content);
    epics.push({
      todoKey: id,
      epicNumber: numMatch ? Number(numMatch[1]) : null,
      title: content,
      planStatus: status,
    });
  }
  return epics;
}

function main() {
  const write = process.argv.includes("--write");
  const text = fs.readFileSync(planPath, "utf8");
  const epics = parseEpics(text);
  if (epics.length !== 176) {
    console.error(`Expected 176 epics from plan frontmatter, parsed ${epics.length}`);
    process.exit(1);
  }

  const payload = {
    version: "0.2.0",
    program: "maximal-assurance",
    programVersion: "1.0.0",
    expectedEpicCount: 176,
    generatedAt: new Date().toISOString(),
    sourcePlan: "artifacts/assurance/maximal-assurance-program.plan.md",
    epics,
  };

  if (!write) {
    console.log(JSON.stringify({ epicCount: epics.length, first: epics[0], last: epics.at(-1) }, null, 2));
    console.error("Dry run. Pass --write to refresh epics.json.");
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${epics.length} epics to ${path.relative(root, outPath)}`);
}

main();
