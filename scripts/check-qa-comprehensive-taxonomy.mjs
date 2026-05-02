#!/usr/bin/env node
/**
 * Validates config/qa-comprehensive-taxonomy.json — forward closure, optional execution audit,
 * optional reverse workflow/check coverage, waiver ratio caps, report artifact.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function envTruthy(name) {
  const v = process.env[name];
  return v === "1" || v === "true" || v === "yes";
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function extractMaximalBundleScripts() {
  const txt = fs.readFileSync(path.join(root, "scripts", "check-qa-maximal-bundle.mjs"), "utf8");
  const start = txt.indexOf("const npmScripts = [");
  if (start === -1) return [];
  const slice = txt.slice(start);
  const end = slice.indexOf("];");
  const block = slice.slice(0, end);
  const out = [];
  const re = /"([^"]+)"/g;
  let m;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
}

function collectTierManifestScripts() {
  const man = readJson(path.join(root, "config", "qa-tier-manifest.json"));
  const out = new Set();
  for (const tier of Object.values(man.tiers || {})) {
    const steps = tier.steps || [];
    for (const s of steps) {
      if (typeof s === "string") out.add(s);
      else if (s && typeof s.script === "string") out.add(s.script);
    }
  }
  return out;
}

function loadWorkflowTextBlob() {
  const dir = path.join(root, ".github", "workflows");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  return files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
}

function resolveFileGlob(ref) {
  const star = ref.indexOf("*");
  if (star === -1) {
    return fs.existsSync(path.join(root, ref));
  }
  const dirPart = ref.slice(0, ref.lastIndexOf("/", star));
  const pattern = ref.slice(dirPart.length + 1);
  const dirPath = path.join(root, dirPart);
  if (!fs.existsSync(dirPath)) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const rx = new RegExp(`^${escaped}$`);
  return fs.readdirSync(dirPath).some((f) => rx.test(f));
}

function resolveArtifactPath(ref) {
  const p = path.join(root, ref);
  if (!fs.existsSync(p)) return false;
  const st = fs.statSync(p);
  if (st.isDirectory()) return true;
  return st.size > 0;
}

function validateSchema(tax) {
  const errors = [];
  if (!tax || typeof tax !== "object") errors.push("root_not_object");
  if (typeof tax.catalogVersion !== "number") errors.push("catalogVersion");
  if (typeof tax.taxonomyVersion !== "number") errors.push("taxonomyVersion");
  if (!Array.isArray(tax.items)) errors.push("items_array");
  const bands = new Set(["P0", "P1", "P2", "P3"]);
  const apps = new Set(["always", "product_absent", "env_strict_only"]);
  const sources = new Set(["assistant_list_1", "assistant_list_2", "assistant_list_3", "deduped"]);
  const kinds = new Set([
    "npmScript",
    "workflow",
    "reusableWorkflow",
    "fileGlob",
    "vitestEntry",
    "e2eSpec",
    "artifactPath",
    "sarifPolicy",
    "waiver",
  ]);
  for (const it of tax.items || []) {
    if (!it.id) errors.push(`item_missing_id`);
    if (!it.section) errors.push(`item_${it.id || "?"}_section`);
    if (!it.title) errors.push(`item_${it.id || "?"}_title`);
    if (!bands.has(it.priorityBand)) errors.push(`item_${it.id}_priorityBand`);
    if (!apps.has(it.applicability)) errors.push(`item_${it.id}_applicability`);
    if (!sources.has(it.source)) errors.push(`item_${it.id}_source`);
    if (!Array.isArray(it.bindings) || it.bindings.length < 1) errors.push(`item_${it.id}_bindings`);
    for (const b of it.bindings || []) {
      if (!kinds.has(b.kind)) errors.push(`item_${it.id}_bad_kind_${b.kind}`);
      if (!b.ref) errors.push(`item_${it.id}_binding_ref`);
    }
  }
  return errors;
}

function main() {
  const taxonomyPath = path.join(root, "config", "qa-comprehensive-taxonomy.json");
  const waiverPath = path.join(root, "config", "qa-external-waiver-registry.json");
  const pkg = readJson(path.join(root, "package.json"));
  const scripts = pkg.scripts || {};
  const waivers = readJson(waiverPath);
  const waiverIds = new Set((waivers.waivers || []).map((w) => w.id));

  const tax = readJson(taxonomyPath);
  const schemaErrors = validateSchema(tax);
  if (schemaErrors.length) {
    console.error(JSON.stringify({ ok: false, schemaErrors }, null, 2));
    process.exit(1);
  }

  const forwardFailures = [];
  const npmRefs = new Set();
  /** @type {{ id: string, ref: string }[]} */
  const waiverBindings = [];

  function bindingResolves(it, b) {
    if (b.kind === "npmScript") {
      npmRefs.add(b.ref);
      return !!scripts[b.ref];
    }
    if (b.kind === "workflow" || b.kind === "reusableWorkflow") {
      const wfPath = path.join(root, ".github", "workflows", b.ref);
      return fs.existsSync(wfPath);
    }
    if (b.kind === "fileGlob" || b.kind === "vitestEntry" || b.kind === "e2eSpec") {
      return resolveFileGlob(b.ref) || fs.existsSync(path.join(root, b.ref));
    }
    if (b.kind === "artifactPath") {
      return resolveArtifactPath(b.ref);
    }
    if (b.kind === "sarifPolicy") {
      return fs.existsSync(path.join(root, b.ref));
    }
    if (b.kind === "waiver") {
      return waiverIds.has(b.ref);
    }
    return false;
  }

  for (const it of tax.items) {
    const okItem = it.bindings.some((b) => bindingResolves(it, b));
    if (!okItem) {
      forwardFailures.push({
        id: it.id,
        reason: "no_binding_resolved",
        bindings: it.bindings,
      });
    }
    for (const b of it.bindings) {
      if (b.kind !== "waiver") continue;
      if (!waiverIds.has(b.ref)) {
        forwardFailures.push({ id: it.id, kind: "waiver", ref: b.ref, reason: "unknown_waiver" });
      } else {
        waiverBindings.push({ id: it.id, ref: b.ref });
      }
    }
  }

  if (forwardFailures.length) {
    console.error(JSON.stringify({ ok: false, forwardFailures }, null, 2));
    process.exit(1);
  }

  const disallowWaivers = envTruthy("QA_TAXONOMY_DISALLOW_WAIVERS");
  const itemsWithAnyWaiverBinding = new Set(
    tax.items
      .filter((it) => it.bindings.some((b) => b.kind === "waiver" && waiverIds.has(b.ref)))
      .map((it) => it.id)
  );

  if (disallowWaivers && itemsWithAnyWaiverBinding.size) {
    console.error(
      JSON.stringify({ ok: false, reason: "waivers_present", count: itemsWithAnyWaiverBinding.size }, null, 2)
    );
    process.exit(1);
  }

  const ratioCap = Number(process.env.QA_TAXONOMY_FAIL_ON_WAIVER_RATIO || "");
  if (!Number.isNaN(ratioCap) && ratioCap > 0) {
    const ratio = itemsWithAnyWaiverBinding.size / tax.items.length;
    if (ratio > ratioCap) {
      console.error(JSON.stringify({ ok: false, reason: "waiver_ratio_exceeded", ratio, ratioCap }, null, 2));
      process.exit(1);
    }
  }

  const bundleScripts = new Set(extractMaximalBundleScripts());
  const tierScripts = collectTierManifestScripts();
  const wfBlob = loadWorkflowTextBlob();

  function isExecuted(scriptName) {
    if (bundleScripts.has(scriptName)) return true;
    if (tierScripts.has(scriptName)) return true;
    if (wfBlob.includes(`"${scriptName}"`) || wfBlob.includes(`'${scriptName}'`)) return true;
    if (wfBlob.includes(`npm run ${scriptName}`) || wfBlob.includes(`run ${scriptName}`)) return true;
    return false;
  }

  const executionGaps = [];
  if (envTruthy("QA_TAXONOMY_EXECUTION_AUDIT")) {
    for (const name of npmRefs) {
      if (!name.startsWith("check:") && !name.startsWith("report:") && !name.startsWith("security:")) continue;
      if (!isExecuted(name)) executionGaps.push(name);
    }
  }

  const strictExec = envTruthy("QA_TAXONOMY_EXECUTION_AUDIT_STRICT");
  if (strictExec && executionGaps.length) {
    console.error(JSON.stringify({ ok: false, reason: "execution_debt", executionGaps }, null, 2));
    process.exit(1);
  }

  let orphanWorkflows = [];
  if (envTruthy("QA_TAXONOMY_WORKFLOW_COVERAGE")) {
    const dir = path.join(root, ".github", "workflows");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml"));
    const claimed = new Set();
    for (const it of tax.items) {
      for (const b of it.bindings) {
        if (b.kind === "workflow" || b.kind === "reusableWorkflow") claimed.add(b.ref);
      }
    }
    const allow = new Set(["pr-process-stub.yml"]);
    orphanWorkflows = files.filter((f) => !claimed.has(f) && !allow.has(f));
    if (orphanWorkflows.length) {
      console.error(JSON.stringify({ ok: false, reason: "orphan_workflows", orphanWorkflows }, null, 2));
      process.exit(1);
    }
  }

  let orphanChecks = [];
  if (envTruthy("QA_TAXONOMY_CHECK_COVERAGE")) {
    const allChecks = Object.keys(scripts).filter((k) => k.startsWith("check:"));
    const claimed = new Set();
    for (const it of tax.items) {
      for (const b of it.bindings) {
        if (b.kind === "npmScript" && b.ref.startsWith("check:")) claimed.add(b.ref);
      }
    }
    orphanChecks = allChecks.filter((c) => !claimed.has(c));
    if (orphanChecks.length) {
      console.error(JSON.stringify({ ok: false, reason: "orphan_checks", orphanChecks }, null, 2));
      process.exit(1);
    }
  }

  let p0nw = 0,
    p1nw = 0,
    p2nw = 0,
    p3nw = 0;
  for (const it of tax.items) {
    const hasWaiver = it.bindings.some((b) => b.kind === "waiver");
    if (hasWaiver) continue;
    if (it.priorityBand === "P0") p0nw++;
    if (it.priorityBand === "P1") p1nw++;
    if (it.priorityBand === "P2") p2nw++;
    if (it.priorityBand === "P3") p3nw++;
  }
  const coverageScoreV1 = p0nw * 3 + p1nw * 2 + p2nw * 1 + p3nw * 0.5 - executionGaps.length * 0.25;

  const report = {
    ok: true,
    catalogVersion: tax.catalogVersion,
    taxonomyVersion: tax.taxonomyVersion,
    generatedAt: new Date().toISOString(),
    counts: {
      items: tax.items.length,
      waiverBindingEvents: waiverBindings.length,
      itemsWithWaiverBinding: itemsWithAnyWaiverBinding.size,
      uniqueNpmRefs: npmRefs.size,
    },
    waiverDebtRatio: itemsWithAnyWaiverBinding.size / tax.items.length,
    executionDebtRatio: tax.items.length ? executionGaps.length / tax.items.length : 0,
    executionGaps,
    orphanWorkflows,
    orphanChecks,
    coverageScoreV1,
    formula:
      "coverageScoreV1 = sum(P0 non-waiver)*3 + sum(P1 non-waiver)*2 + sum(P2 non-waiver)*1 + sum(P3 non-waiver)*0.5 - executionGapCount*0.25",
  };

  const outDir = path.join(root, "artifacts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "qa-comprehensive-taxonomy-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
