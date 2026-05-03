#!/usr/bin/env node
/**
 * Emit docs/assurance.md from vendored plan expanded ### Epic N sections + epics.json + curated evidence registry.
 * Output uses “assurance objective” wording; plan file headings remain ### Epic N for sync tooling.
 * Run from repo root: node scripts/generate-maximal-assurance-directives-doc.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { maximalEpicEvidence } from "./lib/maximal-epic-evidence-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const planPath = path.join(root, "artifacts", "assurance", "maximal-assurance-program.plan.md");
const epicsPath = path.join(root, "artifacts", "assurance", "epics.json");
const outPath = path.join(root, "docs", "assurance.md");

/** Must match scripts/generate-epic-closure.mjs (bulk NA when no maximalEpicEvidence row). */
const NA_BULK_ID = "oblixa_maximal_na_residual_epics";

const plan = fs.readFileSync(planPath, "utf8");
const { epics } = JSON.parse(fs.readFileSync(epicsPath, "utf8"));

function outcomeTitle(raw) {
  return raw.replace(/^Epic \d+:\s*/i, "").trim();
}

/** Plan bullets say “Epic N”; this doc uses “objective N” for cross-references. */
function objectiveCrossrefs(s) {
  return s.replace(/\bEpic\s+(\d+)\b/g, "objective $1");
}

/** Paths referenced by vitest/node evidence strings (explicit files to maintain). */
function pathsFromEvidenceCommand(cmd) {
  if (!cmd || typeof cmd !== "string") return [];
  const out = [];
  const testRe = /\.(?:test|contract\.test|ui\.test|property\.test)\.(?:ts|tsx)$/;
  for (const t of cmd.split(/\s+/)) {
    if (t.startsWith("src/") && testRe.test(t)) out.push(t);
    else if (t.startsWith("e2e/") && t.endsWith(".spec.ts")) out.push(t);
    else if (t.startsWith("scripts/") && t.endsWith(".mjs")) out.push(t);
  }
  return [...new Set(out)];
}

/** Safe inside single-tick Markdown inline code (commands normally contain no backticks). */
function mdInlineCode(s) {
  return String(s).replace(/`/g, "'");
}

/** Map legacy plan paths → current repo paths (same semantics). */
function alignRepoRefs(line) {
  return line
    .replace(
      /\(\[`artifacts\/assurance\/maximal-assurance-plan\.sha256`\]/g,
      "([`artifacts/assurance/maximal-assurance-program.plan.sha256`]"
    )
    .replace(/\[`scripts\/check-epic-registry-sync\.mjs`\]/g, "[`scripts/check-assurance-epics-registry.mjs`]")
    .replace(/\[`scripts\/check-plan-document-integrity\.mjs`\]/g, "[`scripts/check-maximal-assurance-plan-snapshot.mjs`]")
    .replace(/\.github\/workflows\/qa-max-nightly\.yml/g, ".github/workflows/qa-max-nightly.yml");
}

/** Extract ### Epic N — block bodies (until next ### Epic or ## heading). */
function parseEpicBodies(text) {
  const map = new Map();
  // `(?![\s\S])` = end of string (JS has no `\z`; `\z` matches literal `z` and truncates epic bodies).
  const re = /^### Epic (\d+) —[^\n]*\r?\n([\s\S]*?)(?=^### Epic \d+ —|^## [^#]|(?![\s\S]))/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    map.set(Number(m[1]), m[2].trim());
  }
  return map;
}

function bulletsFromBody(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (line.startsWith("- ")) out.push(objectiveCrossrefs(alignRepoRefs(line.slice(2).trim())));
  }
  return out;
}

const bodies = parseEpicBodies(plan);

let md = `# Maximal assurance program — implementation directives

This document **operationalizes** the maximal assurance program as **176 numbered assurance objectives** with concrete implementation and verification steps. Narrative, appendices (A–W), and taxonomy tables remain in the vendored plan; this file tells engineers **what to build, where it lives, and how CI proves it**.

## Authority and sync rules

1. **Canonical narrative + appendices:** [\`artifacts/assurance/maximal-assurance-program.plan.md\`](../artifacts/assurance/maximal-assurance-program.plan.md). Expanded work breakdown uses headings \`### Epic N\` in that file only—keep them aligned with this objective numbering.
2. **Canonical objective index (176 rows, contiguous ids 1–176):** [\`artifacts/assurance/epics.json\`](../artifacts/assurance/epics.json). Keep plan YAML todos + those headings + this JSON aligned (**objective 96** = registry sync). Run \`npm run sync:assurance-epics-from-plan\` only when the vendored plan frontmatter changes.
3. **Plan checksum:** [\`artifacts/assurance/maximal-assurance-program.plan.sha256\`](../artifacts/assurance/maximal-assurance-program.plan.sha256) — gate **objective 116** via \`npm run check:maximal-assurance-plan-snapshot\`.
4. **Program semver:** [\`artifacts/assurance/epics.json\`](../artifacts/assurance/epics.json) field \`programVersion\` — bump when cardinality / phasing / taxonomy lists change (**objective 136**); verify with \`npm run check:assurance-program-semver\`.
5. **Evidence vs explicit NA:** Each objective **1–176** must appear in [\`artifacts/assurance/epic-closure.json\`](../artifacts/assurance/epic-closure.json) as **evidence** (an \`npm run\` / \`vitest run\` / \`node scripts/…\` that exists) or **NA** linked to [\`artifacts/assurance/na-bulk-registry.json\`](../artifacts/assurance/na-bulk-registry.json). After registry edits run \`npm run generate:epic-closure\` and \`npm run check:assurance-epic-closure\`.
6. **STRIDE / dimensions:** Add or extend rows in [\`artifacts/assurance/threat-rows.json\`](../artifacts/assurance/threat-rows.json); validate with \`npm run check:threat-row-coverage\`. Orphan rows and invalid \`npm run …\` references fail CI (**objective 38**).
7. **Scripts inventory:** New \`scripts/check-*.mjs\` / \`scripts/report-*.mjs\` must appear in [\`artifacts/assurance/scripts-to-epic-map.json\`](../artifacts/assurance/scripts-to-epic-map.json) (regenerate via \`npm run generate:scripts-to-epic-map\`) and pass \`npm run check:assurance-catalog-drift\` (**Appendix D**).
8. **Zero-hit scans:** When a dimension does not apply, emit an explicit **NA** row (Appendices **C**, **H**, **P–W**)—never omit the dimension silently.

## Global obligations (every objective)

1. Land **mergeable artifacts** under \`artifacts/assurance/\`, \`artifacts/compliance/\`, or committed script outputs—**not** prose-only checklists marked “done.”
2. Wire **CI**: new gates join \`npm run test:scripts\`, \`npm run check:maximal-assurance-scaffolding\`, or workflows named in the plan (\`.github/workflows/qa-max-nightly.yml\`, \`qa-code-maximal.yml\`, etc.) per **objective 48** (\`scripts/check-qa-workflow-fleet.mjs\`).
3. Each **new \`npm run\` script** must trace to **(a)** a scheduled workflow step, **(b)** \`check:quick\` / \`test:scripts\` ancestry, or **(c)** a waiver id (**Appendix E**).

---

`;

for (const row of epics) {
  const n = row.epicNumber;
  const outcome = outcomeTitle(row.title);
  const body = bodies.get(n) ?? "";
  const bullets = bulletsFromBody(body);

  md += `## Assurance objective ${n}\n\n`;
  md += `**Stable key:** \`${row.todoKey}\` (from [\`artifacts/assurance/epics.json\`](../artifacts/assurance/epics.json)).\n\n`;
  md += `**Outcome:** ${outcome}\n\n`;
  md += `**Plan anchor:** expanded bullets under \`### Epic ${n}\` in [\`artifacts/assurance/maximal-assurance-program.plan.md\`](../artifacts/assurance/maximal-assurance-program.plan.md).\n\n`;
  md += `### Directives\n\n`;
  md +=
    `_Treat each numbered row as a shipping requirement—not narrative guidance._ Where the plan names a behavior, you still owe automated enforcement (tests or scripts) before closure.\n\n`;

  if (bullets.length > 0) {
    bullets.forEach((b, i) => {
      md += `${i + 1}. ` + b + "\n";
    });
    md +=
      `${bullets.length + 1}. ` +
      `Merge implementation with **executable proof**: tests under \`src/**/*.test.ts\`, \`src/**/*.contract.test.ts\`, \`e2e/*.spec.ts\`, or \`scripts/check-*.mjs\` / \`scripts/report-*.mjs\`—each change set should fail CI if the behavior regresses.\n`;
  } else {
    md += `1. Implement the outcome using concrete automation: add or extend \`scripts/check-*.mjs\`, Vitest beside routes (\`*route.test.ts\`), Playwright specs, or committed JSON under \`artifacts/\`—not checklist prose alone.\n`;
    md += `2. Register evidence in [\`scripts/lib/maximal-epic-evidence-registry.mjs\`](../scripts/lib/maximal-epic-evidence-registry.mjs) under numeric key \`${n}\`, **or** record NA via [\`artifacts/assurance/threat-rows.json\`](../artifacts/assurance/threat-rows.json) / [\`artifacts/assurance/na-bulk-registry.json\`](../artifacts/assurance/na-bulk-registry.json) per Appendices **C** and **H**.\n`;
    md += `3. Run \`npm run generate:epic-closure\` and confirm \`npm run check:assurance-epic-closure\` passes.\n`;
  }

  const evidence = maximalEpicEvidence[n];
  md += `\n### Verification and closure\n\n`;
  if (evidence) {
    md +=
      "- **Primary CI command:** `" +
      mdInlineCode(evidence) +
      "` — curated as [`scripts/lib/maximal-epic-evidence-registry.mjs`](../scripts/lib/maximal-epic-evidence-registry.mjs) key `" +
      n +
      "`. Run locally before merge; keep it exiting **0** unless a tracked waiver or bulk NA applies.\n";
    const paths = pathsFromEvidenceCommand(evidence);
    if (paths.length > 0) {
      md +=
        "- **Paths pinned by that command:** " +
        paths.map((p) => "`" + p + "`").join(", ") +
        " — extend or split tests here when behavior changes; do not silence failures without a waiver or NA update.\n";
    }
    md += `- **Closure row:** objective \`${n}\` in [\`artifacts/assurance/epic-closure.json\`](../artifacts/assurance/epic-closure.json) must reference this command (or NA bulk id). Regenerate with \`npm run generate:epic-closure\` whenever the registry entry changes.\n`;
  } else {
    md +=
      `- **Primary CI command:** *bulk N/A (no dedicated gate this revision)* — objective \`${n}\` is closed as **explicit NA** in [\`artifacts/assurance/epic-closure.json\`](../artifacts/assurance/epic-closure.json) via [\`artifacts/assurance/na-bulk-registry.json\`](../artifacts/assurance/na-bulk-registry.json) entry \`${NA_BULK_ID}\`. To ship automated proof instead, add \`${n}: \"…\"\` to [\`scripts/lib/maximal-epic-evidence-registry.mjs\`](../scripts/lib/maximal-epic-evidence-registry.mjs), then run \`npm run generate:epic-closure\`.\n`;
    md +=
      `- **Closure row:** objective \`${n}\` must remain aligned with \`generate-epic-closure\` output; verify with \`npm run check:assurance-epic-closure\` after registry or NA bulk edits.\n`;
  }

  md += `\n---\n\n`;
}

md += `## Document regeneration\n\nRun:\n\n\`\`\`bash\nnode scripts/generate-maximal-assurance-directives-doc.mjs\n\`\`\`\n\nCommit [\`docs/assurance.md\`](assurance.md) whenever expanded plan objective sections (\`### Epic N\` bodies) or [\`artifacts/assurance/epics.json\`](../artifacts/assurance/epics.json) change materially.\n`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md);
console.log(`Wrote ${path.relative(root, outPath)} (${epics.length} assurance objectives)`);
