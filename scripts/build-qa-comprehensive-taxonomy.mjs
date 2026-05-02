#!/usr/bin/env node
/**
 * Writes config/qa-comprehensive-taxonomy.json — union of dimension catalog, WCAG 2.2 SC rows,
 * oblixa spine bindings, and per-script / per-workflow claim rows (bidirectional closure).
 */
import fs from "node:fs";
import path from "node:path";
import { WCAG_22_SUCCESS_CRITERION_NUMBERS_UNIQUE } from "./lib/qa-wcag22-sc-ids.mjs";

const root = process.cwd();
const CATALOG_VERSION = 1;
const TAXONOMY_VERSION = 1;

const WORKFLOW_ALLOWLIST = new Set(["pr-process-stub.yml"]);

function loadPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
}

function listWorkflows() {
  const dir = path.join(root, ".github", "workflows");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
}

function rowBase(overrides) {
  return {
    source: "deduped",
    applicability: "always",
    riskScore: 5,
    bindings: [],
    ...overrides,
  };
}

function buildDimensionRows() {
  const blocks = [
    {
      id: "dim-d01-d12-orchestration-metaqa",
      section: "dimension_catalog",
      title: "D01–D12 Orchestration / meta-QA (flake, duration, quarantine, autodiscover, command integrity)",
      priorityBand: "P0",
      bindings: [
        { kind: "npmScript", ref: "check:checks-integrity-meta" },
        { kind: "npmScript", ref: "check:test-skip-governance" },
        { kind: "npmScript", ref: "check:e2e-quarantine" },
        { kind: "npmScript", ref: "check:command-reference-integrity" },
        { kind: "npmScript", ref: "check:e2e:stability-threshold" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d13-d28-ci-platform",
      section: "dimension_catalog",
      title: "D13–D28 CI / platform (workflows, OIDC, matrices, artifacts)",
      priorityBand: "P1",
      bindings: [
        { kind: "npmScript", ref: "check:qa-workflow-fleet" },
        { kind: "npmScript", ref: "check:ci-change-impact" },
        { kind: "npmScript", ref: "check:github-workflows-security" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d29-d44-vcs-governance",
      section: "dimension_catalog",
      title: "D29–D44 VCS / governance (CODEOWNERS, branch protection, licenses)",
      priorityBand: "P2",
      bindings: [
        { kind: "npmScript", ref: "check:codeowners-security-paths" },
        { kind: "npmScript", ref: "check:branch-protection-drift" },
        { kind: "npmScript", ref: "report:bus-factor-codeowners" },
        { kind: "npmScript", ref: "check:license-sbom" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d45-d72-app-contracts",
      section: "dimension_catalog",
      title: "D45–D72 Application contracts (routes, API, actions, cron, uploads, i18n, MFA)",
      priorityBand: "P0",
      bindings: [
        { kind: "npmScript", ref: "check:api-route-tests" },
        { kind: "npmScript", ref: "check:server-action-exports" },
        { kind: "npmScript", ref: "check:cron-route-auth" },
        { kind: "npmScript", ref: "check:upload-banlist" },
        { kind: "npmScript", ref: "check:public-seo-surface" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d73-d96-data-postgres",
      section: "dimension_catalog",
      title: "D73–D96 Data / Postgres / Supabase (migrations, RLS smoke hooks)",
      priorityBand: "P0",
      bindings: [
        { kind: "npmScript", ref: "check:migrations" },
        { kind: "npmScript", ref: "check:migrations:strict" },
        { kind: "artifactPath", ref: "supabase/migrations" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d97-d120-http-edge",
      section: "dimension_catalog",
      title: "D97–D120 HTTP / CDN / edge (TLS, DNS, cache semantics — smoke scripts)",
      priorityBand: "P2",
      bindings: [
        { kind: "npmScript", ref: "check:certificate-transparency" },
        { kind: "npmScript", ref: "check:outbound-fetch" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d121-d148-web-platform",
      section: "dimension_catalog",
      title: "D121–D148 Web platform / browser (CSP, cookies, permissions)",
      priorityBand: "P1",
      bindings: [
        { kind: "npmScript", ref: "check:auth-cookie-attributes" },
        { kind: "npmScript", ref: "check:next-public-surface" },
        { kind: "npmScript", ref: "check:postmessage-origins" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d149-d168-next-react",
      section: "dimension_catalog",
      title: "D149–D168 Next / React (surface suite, performance static)",
      priorityBand: "P1",
      bindings: [
        { kind: "npmScript", ref: "check:performance-static:strict" },
        { kind: "npmScript", ref: "check:suppress-hydration-warning" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d169-d196-security-engineering",
      section: "dimension_catalog",
      title: "D169–D196 Security engineering (SAST, fetch sinks, enforcement matrix)",
      priorityBand: "P0",
      bindings: [
        { kind: "npmScript", ref: "check:security-static:strict" },
        { kind: "npmScript", ref: "check:security-fetch-sinks:strict" },
        { kind: "npmScript", ref: "check:security-enforcement-matrix:strict" },
        { kind: "npmScript", ref: "security:audit:maximal" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d197-d220-privacy-compliance",
      section: "dimension_catalog",
      title: "D197–D220 Privacy / compliance / legal (subprocessors, jurisdiction artifacts)",
      priorityBand: "P1",
      bindings: [
        { kind: "npmScript", ref: "check:subprocessors-drift:strict" },
        { kind: "artifactPath", ref: "config/global-privacy-law-matrix.json" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d221-d240-reliability-dr",
      section: "dimension_catalog",
      title: "D221–D240 Reliability / DR / SRE (incident readiness, chaos stubs)",
      priorityBand: "P2",
      bindings: [
        { kind: "npmScript", ref: "check:incident-readiness" },
        { kind: "npmScript", ref: "check:flake-stabilization-note" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d241-d260-observability",
      section: "dimension_catalog",
      title: "D241–D260 Observability (contracts, RED metrics artifacts)",
      priorityBand: "P2",
      bindings: [
        { kind: "npmScript", ref: "check:observability-contracts" },
        { kind: "artifactPath", ref: "artifacts/red-metrics-allowlist.json" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d261-d280-analytics-ml-ai",
      section: "dimension_catalog",
      title: "D261–D280 Analytics / ML / AI (event schemas, AI webhook integration test)",
      priorityBand: "P2",
      bindings: [
        { kind: "npmScript", ref: "test:integration:ai-webhook" },
        { kind: "artifactPath", ref: "artifacts/outbox-event-schemas.json" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d281-d300-mobile-embed",
      section: "dimension_catalog",
      title: "D281–D300 Mobile / desktop / embed (WebView workflows)",
      priorityBand: "P3",
      bindings: [
        { kind: "workflow", ref: "qa-android-webview.yml" },
        { kind: "workflow", ref: "qa-ios-wkwebview.yml" },
        { kind: "workflow", ref: "qa-windows-edge-optional.yml" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    },
    {
      id: "dim-d301-reserve",
      section: "dimension_catalog",
      title: "D301+ Reserve / future standards gated by catalogVersion",
      priorityBand: "P3",
      bindings: [{ kind: "artifactPath", ref: "config/qa-taxonomy-strictness-sla.json" }, { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" }],
    },
  ];
  return blocks.map((b) =>
    rowBase({
      id: b.id,
      section: b.section,
      title: b.title,
      priorityBand: b.priorityBand,
      source: "assistant_list_3",
      bindings: b.bindings,
    })
  );
}

function buildSpineRows() {
  return [
    rowBase({
      id: "spine-check-qa-maximal-bundle",
      section: "oblixa_spine",
      title: "Maximal static bundle aggregator (source file; avoids circular npm ref)",
      priorityBand: "P0",
      source: "assistant_list_1",
      bindings: [{ kind: "fileGlob", ref: "scripts/check-qa-maximal-bundle.mjs" }],
    }),
    rowBase({
      id: "spine-qa-tier-manifest",
      section: "oblixa_spine",
      title: "QA ultimate tier manifest",
      priorityBand: "P0",
      source: "assistant_list_1",
      bindings: [{ kind: "artifactPath", ref: "config/qa-tier-manifest.json" }],
    }),
    rowBase({
      id: "spine-pipeline-qa-ultimate",
      section: "oblixa_spine",
      title: "pipeline-qa-ultimate.mjs orchestrator",
      priorityBand: "P0",
      source: "assistant_list_1",
      bindings: [{ kind: "fileGlob", ref: "scripts/pipelines/pipeline-qa-ultimate.mjs" }],
    }),
    rowBase({
      id: "spine-reusable-qa-ultimate-workflow",
      section: "oblixa_spine",
      title: "Reusable workflow reusable-qa-ultimate.yml",
      priorityBand: "P1",
      source: "assistant_list_3",
      bindings: [{ kind: "reusableWorkflow", ref: "reusable-qa-ultimate.yml" }],
    }),
    rowBase({
      id: "spine-pipeline-qa-max",
      section: "oblixa_spine",
      title: "pipeline-qa-max.mjs sweep tiers",
      priorityBand: "P0",
      source: "assistant_list_1",
      bindings: [{ kind: "fileGlob", ref: "scripts/pipelines/pipeline-qa-max.mjs" }],
    }),
    rowBase({
      id: "spine-pipeline-qa-code-maximal",
      section: "oblixa_spine",
      title: "pipeline-qa-code-maximal.mjs",
      priorityBand: "P0",
      source: "assistant_list_1",
      bindings: [{ kind: "fileGlob", ref: "scripts/pipelines/pipeline-qa-code-maximal.mjs" }],
    }),
    rowBase({
      id: "spine-qa-maximal-sweep-track-registry",
      section: "oblixa_spine",
      title: "Macro-phase sweep track registry",
      priorityBand: "P1",
      source: "assistant_list_1",
      bindings: [{ kind: "artifactPath", ref: "config/qa-maximal-sweep-track-registry.json" }],
    }),
    rowBase({
      id: "spine-comprehensive-pass-distinct",
      section: "oblixa_spine",
      title: "Live comprehensive-pass integration (distinct from taxonomy checker)",
      priorityBand: "P1",
      source: "assistant_list_1",
      bindings: [{ kind: "npmScript", ref: "check:comprehensive-pass" }],
    }),
    rowBase({
      id: "spine-security-enforcement-matrix",
      section: "oblixa_spine",
      title: "Security enforcement matrix (strict)",
      priorityBand: "P0",
      source: "assistant_list_2",
      bindings: [
        { kind: "artifactPath", ref: "config/security-enforcement-matrix.json" },
        { kind: "npmScript", ref: "check:security-enforcement-matrix:strict" },
      ],
    }),
    rowBase({
      id: "spine-control-traceability",
      section: "oblixa_spine",
      title: "Control traceability governance",
      priorityBand: "P0",
      source: "assistant_list_1",
      bindings: [{ kind: "npmScript", ref: "check:control-traceability" }],
    }),
    rowBase({
      id: "spine-qa-waiver-registry",
      section: "oblixa_spine",
      title: "External waiver registry validation",
      priorityBand: "P0",
      source: "assistant_list_3",
      bindings: [
        { kind: "artifactPath", ref: "config/qa-external-waiver-registry.json" },
        { kind: "npmScript", ref: "check:qa-waiver-registry" },
      ],
    }),
    rowBase({
      id: "spine-compliance-config-glob",
      section: "oblixa_spine",
      title: "Compliance config directory present",
      priorityBand: "P2",
      source: "assistant_list_2",
      bindings: [{ kind: "fileGlob", ref: "config/compliance/*.json" }],
    }),
    rowBase({
      id: "meta-strictness-sla",
      section: "meta_strictness_sla",
      title: "Taxonomy strictness SLA milestones (waiver ratio caps)",
      priorityBand: "P0",
      source: "assistant_list_3",
      bindings: [{ kind: "artifactPath", ref: "config/qa-taxonomy-strictness-sla.json" }],
    }),
    rowBase({
      id: "meta-phase2-tracks-registry",
      section: "phase2_backlog",
      title: "Phase-2 burn-down track registry (machine-readable)",
      priorityBand: "P2",
      source: "deduped",
      bindings: [
        { kind: "artifactPath", ref: "config/qa-taxonomy-phase2-tracks.json" },
        { kind: "waiver", ref: "qa_taxonomy_gap_phase2_feature" },
      ],
    }),
  ];
}

function scToId(sc) {
  return `wcag22-${sc.replace(/\./g, "-")}`;
}

function buildWcagRows() {
  return WCAG_22_SUCCESS_CRITERION_NUMBERS_UNIQUE.map((sc) =>
    rowBase({
      id: scToId(sc),
      section: "wcag22",
      title: `WCAG 2.2 Success Criterion ${sc}`,
      priorityBand: "P3",
      source: "assistant_list_3",
      applicability: "always",
      bindings: [
        { kind: "npmScript", ref: "check:authenticated-a11y-matrix" },
        { kind: "waiver", ref: "qa_taxonomy_gap_wcag22_automation" },
      ],
    })
  );
}

/** Rows beyond wcag22-* SC ids (extensions, EN 301 549, cognitive hints). */
function buildWcagExtensionRows() {
  return [
    rowBase({
      id: "a11y-ext-en301549-508-suite",
      section: "wcag_extensions",
      title: "EN 301 549 / Section 508 alignment suite (Playwright)",
      priorityBand: "P3",
      source: "assistant_list_3",
      applicability: "always",
      bindings: [
        { kind: "e2eSpec", ref: "e2e/a11y-en301549-508.spec.ts" },
        { kind: "waiver", ref: "qa_taxonomy_gap_wcag22_automation" },
      ],
    }),
    rowBase({
      id: "a11y-ext-wcag22-extensions",
      section: "wcag_extensions",
      title: "WCAG 2.2 extension / experimental SC coverage (Playwright)",
      priorityBand: "P3",
      source: "assistant_list_3",
      applicability: "always",
      bindings: [
        { kind: "e2eSpec", ref: "e2e/a11y-wcag22-extensions.spec.ts" },
        { kind: "waiver", ref: "qa_taxonomy_gap_wcag22_automation" },
      ],
    }),
    rowBase({
      id: "a11y-ext-cognitive-timeout-hints",
      section: "wcag_extensions",
      title: "Cognitive / timeout hints coverage (Playwright)",
      priorityBand: "P3",
      source: "assistant_list_3",
      applicability: "always",
      bindings: [
        { kind: "e2eSpec", ref: "e2e/a11y-cognitive-timeout-hints.spec.ts" },
        { kind: "waiver", ref: "qa_taxonomy_gap_wcag22_automation" },
      ],
    }),
  ];
}

function buildCheckClaimRows(pkg) {
  const scripts = pkg.scripts || {};
  const names = Object.keys(scripts)
    .filter((k) => k.startsWith("check:"))
    .sort();
  return names.map((name) =>
    rowBase({
      id: `bind-check-${name.replace(/:/g, "-")}`,
      section: "reverse_bind_check",
      title: `Claim npm script ${name}`,
      priorityBand: "P2",
      source: "deduped",
      bindings: [{ kind: "npmScript", ref: name }],
    })
  );
}

function buildWorkflowRows(files) {
  const rows = [];
  for (const f of files) {
    if (WORKFLOW_ALLOWLIST.has(f)) {
      rows.push(
        rowBase({
          id: `infra-only-workflow-${f.replace(/\./g, "-")}`,
          section: "reverse_bind_workflow",
          title: `Infra-only / stub workflow ${f}`,
          priorityBand: "P3",
          applicability: "product_absent",
          bindings: [{ kind: "waiver", ref: "infra_only_workflow_no_product_surface" }],
        })
      );
      continue;
    }
    rows.push(
      rowBase({
        id: `bind-workflow-${f.replace(/\./g, "-")}`,
        section: "reverse_bind_workflow",
        title: `Claim GitHub workflow ${f}`,
        priorityBand: "P2",
        source: "deduped",
        bindings: [{ kind: "workflow", ref: f }],
      })
    );
  }
  return rows;
}

function main() {
  const pkg = loadPackageJson();
  const workflows = listWorkflows();

  const items = [
    ...buildSpineRows(),
    ...buildDimensionRows(),
    ...buildWcagRows(),
    ...buildWcagExtensionRows(),
    ...buildCheckClaimRows(pkg),
    ...buildWorkflowRows(workflows),
  ];

  const taxonomy = {
    catalogVersion: CATALOG_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    aliases: [],
    items,
  };

  const outPath = path.join(root, "config", "qa-comprehensive-taxonomy.json");
  fs.writeFileSync(outPath, `${JSON.stringify(taxonomy, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outPath, itemCount: items.length }, null, 2));
}

main();
