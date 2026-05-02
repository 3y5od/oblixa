#!/usr/bin/env node
/**
 * Merge Playwright (or other) JUnit XML shards into test-results/junit-merged.xml.
 * Inputs: recursive *.xml under JUNIT_INPUT_ROOT (default junit-all) or first CLI arg.
 * Uses junit-report-merger (jrm). No-op with exit 0 when no XML files found.
 *
 * When many shards exist, jrm may load all inputs at once. Set JUNIT_MERGE_BATCH (default 80)
 * to merge in rounds into temp files, reducing peak RSS for huge shard counts.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function runJrm(dest, fileList) {
  const jrm = path.join(root, "node_modules", ".bin", "jrm");
  const bin = fs.existsSync(jrm) ? jrm : null;
  return bin
    ? spawnSync(jrm, [dest, ...fileList], { stdio: "inherit", cwd: root })
    : spawnSync("npx", ["--yes", "junit-report-merger@9.0.3", dest, ...fileList], { stdio: "inherit", cwd: root });
}

function collectXmlFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.name.endsWith(".xml")) out.push(p);
    }
  }
  return out.sort();
}

const inputRoot = path.resolve(process.env.JUNIT_INPUT_ROOT || process.argv[2] || path.join(root, "junit-all"));
const destRel = process.env.JUNIT_MERGE_OUT || "test-results/junit-merged.xml";
const dest = path.isAbsolute(destRel) ? destRel : path.join(root, destRel);

const xmls = collectXmlFiles(inputRoot);
if (!xmls.length) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "no_junit_xml_found", inputRoot }, null, 2));
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });

const batchRaw = Number(process.env.JUNIT_MERGE_BATCH ?? 80);
const batchSize = Number.isFinite(batchRaw) ? Math.min(500, Math.max(10, Math.floor(batchRaw))) : 80;

function mergeInBatches(files) {
  if (files.length <= batchSize) {
    return runJrm(dest, files);
  }
  const tmpDir = path.join(root, "test-results", ".junit-merge-tmp");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  let current = [...files];
  let round = 0;
  while (current.length > batchSize) {
    const next = [];
    for (let i = 0; i < current.length; i += batchSize) {
      const batch = current.slice(i, i + batchSize);
      const outPath = path.join(tmpDir, `round-${round}-batch-${i}.xml`);
      const r = runJrm(outPath, batch);
      if (r.error) {
        console.error(r.error);
        process.exit(1);
      }
      if (r.status !== 0) process.exit(r.status ?? 1);
      next.push(outPath);
    }
    for (const p of current) {
      if (p.startsWith(tmpDir + path.sep)) fs.unlinkSync(p);
    }
    round += 1;
    current = next;
  }
  const finalCmd = runJrm(dest, current);
  for (const p of current) {
    if (p.startsWith(tmpDir + path.sep)) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return finalCmd;
}

const cmd = mergeInBatches(xmls);

if (cmd.error) {
  console.error(cmd.error);
  process.exit(1);
}
process.exit(cmd.status ?? 1);
