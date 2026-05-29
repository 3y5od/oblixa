#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const CONFIG_REL = "config/operational-threat-model-control-traceability.json";
const ARTIFACT_REL = "artifacts/operational-threat-model-control-traceability.json";
const STRIDE_ARTIFACT_REL = "artifacts/stride-dread-threat-model.json";

const STRIDE_LABELS = new Set([
  "spoofing",
  "tampering",
  "repudiation",
  "information-disclosure",
  "denial-of-service",
  "elevation-of-privilege",
]);

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE", "ACTION"]);

function stableStringify(value) {
  return `${JSON.stringify(value)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))].sort((a, b) => String(a).localeCompare(String(b)));
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function commandText(script) {
  return `npm run ${script}`;
}

function validationCommandExists(scripts, command) {
  if (typeof command !== "string" || !command.trim()) return false;
  if (scripts[command]) return true;
  if (command.startsWith("npm run ")) return Boolean(scripts[command.slice("npm run ".length)]);
  return false;
}

function validateConfiguredCommands(root, config, scripts, issues) {
  const ci = read(root, ".github/workflows/ci.yml");
  const rows = [];

  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(scripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("control_traceability_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("control_traceability_missing_ci_command", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        covers: uniqueSorted(row.covers ?? []),
      });
    }

    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && rel !== STRIDE_ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("control_traceability_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }

  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function countBy(rows, key) {
  const out = {};
  for (const row of rows) {
    const value = typeof key === "function" ? key(row) : row[key];
    out[value] = (out[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function splitEvidenceRefs(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return uniqueSorted(value.split(/[,\s]+/).map((entry) => entry.trim()).filter((entry) => entry.startsWith("scripts/") || entry.startsWith("src/") || entry.startsWith("e2e/")));
}

function analyzeSecurityControlRows(root, config, securityRows, issues) {
  const byId = new Map();
  const requiredOwasp = new Set(config.requiredOwaspApiControls ?? []);
  const owaspPresent = new Set();
  let highPriorityRows = 0;
  let evidenceLinkedRows = 0;
  let manualRows = 0;

  for (const row of securityRows) {
    if (!row.sec_id) issues.push(issue("security_control_missing_id", { row }));
    if (row.sec_id && byId.has(row.sec_id)) issues.push(issue("security_control_duplicate_id", { secId: row.sec_id }));
    if (row.sec_id) byId.set(row.sec_id, row);
    if (!row.title) issues.push(issue("security_control_missing_title", { secId: row.sec_id ?? null }));
    if (!row.priority) issues.push(issue("security_control_missing_priority", { secId: row.sec_id ?? null }));
    if (!row.owner_team) issues.push(issue("security_control_missing_owner", { secId: row.sec_id ?? null }));

    const evidenceRefs = splitEvidenceRefs(row.E_refs);
    const hasManual = typeof row.M_refs === "string" && row.M_refs.trim().length > 0;
    if (evidenceRefs.length > 0) evidenceLinkedRows += 1;
    if (hasManual) manualRows += 1;
    if (["P0", "P1"].includes(row.priority)) {
      highPriorityRows += 1;
      if (evidenceRefs.length === 0 && !row.n_a_rationale) {
        issues.push(issue("high_priority_security_control_missing_evidence", { secId: row.sec_id }));
      }
    }

    for (const rel of evidenceRefs) {
      if (!fs.existsSync(path.join(root, rel))) {
        issues.push(issue("security_control_missing_evidence_path", { secId: row.sec_id, path: rel }));
      }
    }

    if (requiredOwasp.has(row.sec_id)) owaspPresent.add(row.sec_id);
  }

  for (const secId of requiredOwasp) {
    if (!owaspPresent.has(secId)) issues.push(issue("missing_required_owasp_api_control", { secId }));
  }

  return {
    rowCount: securityRows.length,
    highPriorityRows,
    evidenceLinkedRows,
    manualRows,
    priorityCounts: countBy(securityRows, "priority"),
    requiredOwaspApiControls: [...requiredOwasp].sort().map((secId) => ({
      secId,
      present: owaspPresent.has(secId),
      evidenceRefs: splitEvidenceRefs(byId.get(secId)?.E_refs),
    })),
  };
}

function analyzeFrameworkControlMap(root, controls, issues) {
  const rows = [];
  for (const row of controls) {
    const testPaths = Array.isArray(row.testPaths) ? row.testPaths : [];
    const exempt = typeof row.exemptCode === "string" && row.exemptCode.trim().length > 0;
    if (!row.controlId) issues.push(issue("framework_control_missing_id", { row }));
    if (testPaths.length === 0 && !exempt) {
      issues.push(issue("framework_control_missing_tests_or_exemption", { controlId: row.controlId ?? null }));
    }
    for (const rel of testPaths) {
      if (!fs.existsSync(path.join(root, rel))) {
        issues.push(issue("framework_control_missing_test_path", { controlId: row.controlId, path: rel }));
      }
    }
    rows.push({
      controlId: row.controlId ?? null,
      framework: row.framework ?? null,
      testPathCount: testPaths.length,
      exempt: Boolean(exempt),
    });
  }
  return {
    controlCount: rows.length,
    byFramework: countBy(rows, "framework"),
    rows: rows.sort((a, b) => String(a.controlId).localeCompare(String(b.controlId))),
  };
}

function resolveThreatEvidence(root, scripts, evidence, issues, rowId) {
  if (typeof evidence !== "string" || !evidence.trim()) {
    issues.push(issue("threat_row_missing_evidence", { id: rowId }));
    return null;
  }
  const commandMatch = /^npm run\s+(\S+)/.exec(evidence.trim());
  if (commandMatch) {
    const script = commandMatch[1];
    if (!scripts[script]) issues.push(issue("threat_row_missing_package_script", { id: rowId, script }));
    return { kind: "package-script", ref: script };
  }
  if (evidence.startsWith("scripts/") || evidence.startsWith("src/") || evidence.startsWith("e2e/")) {
    if (!fs.existsSync(path.join(root, evidence))) issues.push(issue("threat_row_missing_file_evidence", { id: rowId, path: evidence }));
    return { kind: "file", ref: evidence };
  }
  issues.push(issue("threat_row_unrecognized_evidence", { id: rowId, evidence }));
  return null;
}

function analyzeThreatRows(root, scripts, threatRows, issues) {
  const now = Date.now();
  const evidenceRows = [];
  const naRows = [];

  for (const row of threatRows) {
    if (!row.id || !row.dimensionId || !row.status || !row.owner) {
      issues.push(issue("threat_row_missing_required_fields", { row }));
      continue;
    }
    if (row.status === "evidence") {
      const evidence = resolveThreatEvidence(root, scripts, row.evidenceScriptOrTest, issues, row.id);
      evidenceRows.push({ id: row.id, dimensionId: row.dimensionId, owner: row.owner, evidence });
    } else if (row.status === "na") {
      if (!row.naWaiverId) issues.push(issue("threat_row_missing_na_waiver", { id: row.id }));
      if (!row.expiresAt) {
        issues.push(issue("threat_row_missing_expiry", { id: row.id }));
      } else {
        const expiryMs = Date.parse(`${row.expiresAt}T23:59:59.999Z`);
        if (Number.isNaN(expiryMs) || expiryMs < now) {
          issues.push(issue("threat_row_expired_or_invalid", { id: row.id, expiresAt: row.expiresAt }));
        }
      }
      naRows.push({
        id: row.id,
        dimensionId: row.dimensionId,
        owner: row.owner,
        naWaiverId: row.naWaiverId ?? null,
        expiresAt: row.expiresAt ?? null,
      });
    } else {
      issues.push(issue("threat_row_invalid_status", { id: row.id, status: row.status }));
    }
  }

  return {
    rowCount: threatRows.length,
    evidenceCount: evidenceRows.length,
    notApplicableCount: naRows.length,
    byStatus: countBy(threatRows, "status"),
    evidenceRows: evidenceRows.sort((a, b) => a.id.localeCompare(b.id)),
    notApplicableRows: naRows.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function classifyAttackSurface(row) {
  const categories = [];
  const route = row.route ?? "";
  const providers = row.providers ?? [];

  if (row.class === "cron") categories.push("background-job");
  if (row.class === "webhook") categories.push("webhook");
  if (row.class === "external_token" || row.class === "tracking" || row.authModel === "public_or_token" || /token|track/i.test(route)) {
    categories.push("tokenized-link");
  }
  if (/oauth|callback/i.test(route)) categories.push("oauth-callback");
  if (/upload|file|extract|import/i.test(route) || providers.includes("storage") || providers.includes("openai")) {
    categories.push("upload-file-extraction");
  }
  if (/export|download|report/i.test(route)) categories.push("export-reporting");
  if (providers.length > 0) categories.push("provider-call");
  if (row.authModel === "session" || row.authModel === "session_required_by_default") categories.push("authenticated-endpoint");
  if (row.authModel === "public" || row.class === "public_page") categories.push("public-endpoint");
  if (row.kind === "server_action") categories.push("server-action");

  return uniqueSorted(categories.length ? categories : ["other"]);
}

export function mapStrideThreats(row, categories = classifyAttackSurface(row)) {
  const threats = new Set();
  const methods = row.methods ?? [];
  const mutating = methods.some((method) => MUTATING_METHODS.has(method));
  const auth = row.authModel ?? "";

  if (auth !== "public" || categories.includes("webhook") || categories.includes("tokenized-link")) threats.add("spoofing");
  if (mutating || categories.includes("webhook") || categories.includes("background-job") || row.bodyPolicy !== "no_body_expected") threats.add("tampering");
  if (mutating || categories.includes("background-job") || categories.includes("provider-call")) threats.add("repudiation");
  if (auth !== "public" || categories.includes("export-reporting") || categories.includes("provider-call") || (row.dbDependencies?.tables?.length ?? 0) > 0) {
    threats.add("information-disclosure");
  }
  if (row.kind === "api_route" || row.kind === "server_action" || categories.includes("background-job") || categories.includes("webhook")) {
    threats.add("denial-of-service");
  }
  if (auth === "session" || auth === "session_required_by_default" || categories.includes("oauth-callback") || row.orgScopeRequired) {
    threats.add("elevation-of-privilege");
  }

  return [...STRIDE_LABELS].filter((label) => threats.has(label));
}

function dreadScore(row, categories) {
  const baseByTier = { P0: 9, P1: 7, P2: 5, P3: 3 };
  const base = baseByTier[row.riskTier] ?? 4;
  const publicExposure = categories.includes("public-endpoint") || categories.includes("tokenized-link") || categories.includes("webhook");
  const providerExposure = categories.includes("provider-call") || categories.includes("background-job");
  const mutating = (row.methods ?? []).some((method) => MUTATING_METHODS.has(method));
  const dynamic = (row.dynamicSegments ?? []).length > 0;
  const cap = (value) => Math.max(1, Math.min(10, value));

  const damage = cap(base + (providerExposure ? 1 : 0) + (categories.includes("export-reporting") ? 1 : 0));
  const reproducibility = cap(base - (dynamic ? 1 : 0) + (publicExposure ? 1 : 0));
  const exploitability = cap(base + (publicExposure ? 1 : 0) + (mutating ? 1 : 0));
  const affectedUsers = cap(base + (row.authModel === "session" ? 1 : 0) + ((row.dbDependencies?.tables?.length ?? 0) > 0 ? 1 : 0));
  const discoverability = cap(base + (row.kind === "api_route" || publicExposure ? 1 : 0));
  const average = Number(((damage + reproducibility + exploitability + affectedUsers + discoverability) / 5).toFixed(1));

  return {
    damage,
    reproducibility,
    exploitability,
    affectedUsers,
    discoverability,
    average,
    risk: average >= 8 ? "critical" : average >= 6 ? "high" : average >= 4 ? "medium" : "low",
  };
}

function testCandidates(sourcePath) {
  if (!sourcePath) return [];
  const ext = path.extname(sourcePath);
  const base = sourcePath.slice(0, -ext.length);
  const candidates = [`${base}.test${ext}`];
  if (sourcePath.endsWith("/route.ts")) candidates.push(path.join(path.dirname(sourcePath), "route.test.ts").replace(/\\/g, "/"));
  if (ext === ".ts") candidates.push(`${base}.test.tsx`);
  if (ext === ".tsx") candidates.push(`${base}.test.ts`);
  return uniqueSorted(candidates);
}

function staticChecksForSurface(row, categories) {
  const checks = new Set(["check:control-traceability:strict"]);
  const mutating = (row.methods ?? []).some((method) => MUTATING_METHODS.has(method));

  if (row.kind === "api_route") {
    checks.add("check:api-route-auth-contract");
    checks.add("check:api-route-rate-limit-coverage");
    checks.add("check:security-route-matrix");
  }
  if (row.kind === "server_action") {
    checks.add("check:server-action-auth-contract");
    checks.add("check:server-action-org-scope");
    checks.add("check:server-action-negative-tests");
  }
  if (categories.includes("background-job")) {
    checks.add("check:cron-route-auth");
    checks.add("check:scheduled-cron-route-wrappers");
  }
  if (categories.includes("webhook")) {
    checks.add("check:webhook-inbound-policy");
    checks.add("check:operational-webhooks-callbacks");
  }
  if (categories.includes("provider-call")) {
    checks.add("check:security-fetch-sinks:strict");
    checks.add("check:operational-provider-integrations");
  }
  if (mutating) {
    checks.add("check:csrf-surface-guards");
    checks.add("check:idempotency-policy");
  }
  if (["P0", "P1"].includes(row.riskTier)) {
    checks.add("check:security-control-coverage");
    checks.add("check:operational-rate-limits-abuse-bounds");
  }
  if (row.authModel === "session") checks.add("check:api-tenant-isolation");

  return [...checks].sort((a, b) => a.localeCompare(b));
}

function trustBoundariesForSurface(row, categories) {
  const boundaries = [];
  if (row.kind === "api_route") boundaries.push("browser-or-client-to-next-api-route");
  if (row.kind === "page") boundaries.push("browser-to-server-rendered-page");
  if (row.kind === "server_action") boundaries.push("browser-form-to-server-action");
  if (categories.includes("background-job")) boundaries.push("scheduler-to-cron-route");
  if (categories.includes("webhook")) boundaries.push("external-provider-to-webhook-route");
  if (categories.includes("tokenized-link")) boundaries.push("external-tokenized-link-to-route");
  if ((row.providers ?? []).length > 0) boundaries.push("next-server-to-external-provider");
  if ((row.dbDependencies?.tables?.length ?? 0) > 0 || (row.dbDependencies?.rpcs?.length ?? 0) > 0) boundaries.push("next-server-to-supabase");
  return uniqueSorted(boundaries);
}

function buildSecurityRouteIndex(securityRouteRows) {
  const byFile = new Map();
  const bySecId = new Map();
  for (const row of securityRouteRows) {
    const file = row.route_file ?? row.routeFile;
    if (file) {
      const rows = byFile.get(file) ?? [];
      rows.push(row);
      byFile.set(file, rows);
    }
    for (const secId of row.sec_ids ?? row.secIds ?? []) {
      const rows = bySecId.get(secId) ?? [];
      rows.push(row);
      bySecId.set(secId, rows);
    }
  }
  return { byFile, bySecId };
}

function buildControlMetadata(row, routeSecurityRows) {
  const secIds = uniqueSorted(routeSecurityRows.flatMap((entry) => entry.sec_ids ?? entry.secIds ?? []));
  const auditExpectations = uniqueSorted(routeSecurityRows.map((entry) => entry.audit_event_expectation ?? entry.auditEventExpectation));
  const csrfPolicies = uniqueSorted(routeSecurityRows.map((entry) => entry.csrf_origin_policy ?? entry.csrfOriginPolicy));
  const idempotencyPolicies = uniqueSorted(routeSecurityRows.map((entry) => entry.idempotency_or_job_lock_policy ?? entry.idempotencyOrJobLockPolicy));

  return {
    auth: row.authModel ?? null,
    authzControls: {
      rolePolicy: uniqueSorted(row.rolePolicy ?? []),
      orgScopeRequired: Boolean(row.orgScopeRequired),
      orgScopeEvidence: Boolean(row.orgScopeEvidence),
    },
    rateLimit: row.rateLimitPolicy ?? null,
    logging: {
      observabilityRequired: Boolean(row.observabilityRequired),
      auditEventExpectations: auditExpectations,
    },
    abuseControls: {
      bodyPolicy: row.bodyPolicy ?? null,
      cachePolicy: row.cachePolicy ?? null,
      csrfPolicies,
      idempotencyOrJobLockPolicies: idempotencyPolicies,
      securityControlIds: secIds,
    },
  };
}

function buildEvidence(root, scripts, row, categories) {
  const directTests = testCandidates(row.sourcePath).filter((rel) => fs.existsSync(path.join(root, rel)));
  const staticChecks = staticChecksForSurface(row, categories).map((script) => ({
    script,
    present: Boolean(scripts[script]),
  }));
  const generatedArtifacts = uniqueSorted([
    "artifacts/route-universe.json",
    row.kind === "api_route" ? "artifacts/security-route-matrix.json" : null,
    ["P0", "P1"].includes(row.riskTier) ? "artifacts/security-control-coverage-matrix.rows.json" : null,
  ]).map((rel) => ({ path: rel, present: fs.existsSync(path.join(root, rel)) }));

  return { directTests, staticChecks, generatedArtifacts };
}

function validateAttackSurfaceEvidence(root, config, scripts, row, surface, issues) {
  const highRisk = (config.highRiskTiers ?? []).includes(row.riskTier);
  const hasDirectTest = surface.evidence.directTests.length > 0;
  const hasStaticCheck = surface.evidence.staticChecks.some((entry) => entry.present);
  const hasArtifact = surface.evidence.generatedArtifacts.some((entry) => entry.present);
  const requiredMetadata = [
    ["authModel", row.authModel],
    ["rateLimitPolicy", row.rateLimitPolicy],
    ["bodyPolicy", row.bodyPolicy],
    ["cachePolicy", row.cachePolicy],
    ["owner", row.owner],
    ["riskTier", row.riskTier],
  ];

  for (const [field, value] of requiredMetadata) {
    if (value == null || value === "") issues.push(issue("attack_surface_missing_required_metadata", { id: row.id, route: row.route, field }));
  }
  for (const entry of surface.evidence.staticChecks) {
    if (!entry.present) issues.push(issue("attack_surface_missing_static_check_script", { id: row.id, route: row.route, script: entry.script }));
  }
  for (const entry of surface.evidence.generatedArtifacts) {
    if (!entry.present) issues.push(issue("attack_surface_missing_generated_artifact", { id: row.id, route: row.route, path: entry.path }));
  }
  if (highRisk && !hasDirectTest && !hasStaticCheck && !hasArtifact) {
    issues.push(issue("high_risk_attack_surface_orphan", { id: row.id, route: row.route, sourcePath: row.sourcePath }));
  }
}

function buildAttackSurfaceInventory(root, config, scripts, routeRows, securityRouteRows, issues) {
  const securityIndex = buildSecurityRouteIndex(securityRouteRows);
  const surfaces = [];
  const allStride = new Set();

  for (const row of routeRows) {
    const categories = classifyAttackSurface(row);
    const strideCategories = mapStrideThreats(row, categories);
    const routeSecurityRows = securityIndex.byFile.get(row.sourcePath) ?? [];
    const controls = buildControlMetadata(row, routeSecurityRows);
    const surface = {
      id: row.id,
      route: row.route,
      sourcePath: row.sourcePath,
      kind: row.kind,
      class: row.class,
      methods: uniqueSorted(row.methods ?? []),
      riskTier: row.riskTier,
      owner: row.owner,
      attackSurfaceClasses: categories,
      trustBoundaries: trustBoundariesForSurface(row, categories),
      providers: uniqueSorted(row.providers ?? []),
      dataStores: {
        tables: uniqueSorted(row.dbDependencies?.tables ?? []),
        rpcs: uniqueSorted(row.dbDependencies?.rpcs ?? []),
      },
      strideCategories,
      dread: dreadScore(row, categories),
      owaspControls: controls.abuseControls.securityControlIds.filter((secId) => secId.startsWith("SEC-API")),
      controls,
      evidence: buildEvidence(root, scripts, row, categories),
    };
    validateAttackSurfaceEvidence(root, config, scripts, row, surface, issues);
    for (const category of strideCategories) allStride.add(category);
    surfaces.push(surface);
  }

  for (const required of config.requiredStrideCategories ?? []) {
    if (!allStride.has(required)) issues.push(issue("missing_stride_category_coverage", { category: required }));
  }
  const attackClassCounts = countBy(surfaces.flatMap((surface) => surface.attackSurfaceClasses).map((attackSurfaceClass) => ({ attackSurfaceClass })), "attackSurfaceClass");
  for (const requiredClass of config.requiredAttackSurfaceClasses ?? []) {
    if (!attackClassCounts[requiredClass]) issues.push(issue("missing_attack_surface_class", { attackSurfaceClass: requiredClass }));
  }

  return {
    rowCount: surfaces.length,
    highRiskSurfaceCount: surfaces.filter((surface) => (config.highRiskTiers ?? []).includes(surface.riskTier)).length,
    byAttackSurfaceClass: attackClassCounts,
    byRiskTier: countBy(surfaces, "riskTier"),
    byKind: countBy(surfaces, "kind"),
    strideCoverage: [...STRIDE_LABELS].map((category) => ({
      category,
      surfaceCount: surfaces.filter((surface) => surface.strideCategories.includes(category)).length,
    })),
    rows: surfaces.sort((a, b) => `${a.route}:${a.sourcePath}:${a.kind}`.localeCompare(`${b.route}:${b.sourcePath}:${b.kind}`)),
  };
}

function analyzeMinimums(config, inventory, securityControls, threatRows, issues) {
  const minimums = config.minimums ?? {};
  const checks = [
    ["attackSurfaceRows", inventory.rowCount],
    ["highRiskSurfaceRows", inventory.highRiskSurfaceCount],
    ["securityControlRows", securityControls.rowCount],
    ["threatRows", threatRows.rowCount],
  ];
  const rows = [];
  for (const [metric, current] of checks) {
    const minimum = minimums[metric] ?? 0;
    const ok = current >= minimum;
    if (!ok) issues.push(issue("control_traceability_minimum_not_met", { metric, minimum, current }));
    rows.push({ metric, minimum, current, ok });
  }
  return rows;
}

function residualOwnerForOwnerArea(ownerArea) {
  return ownerArea ? `@${ownerArea}` : null;
}

function analyzeResidualRisks(root, config, scripts, threatRows, issues) {
  const waivers = readJson(root, "config/qa-external-waiver-registry.json", { waivers: [] })?.waivers ?? [];
  const manualBoundaries = readJson(root, "config/operational-manual-boundaries.json", { manualActions: [] });
  const policy = config.residualRiskPolicy ?? {};
  const impactByCategory = policy.impactByManualBoundaryCategory ?? {};
  const defaultManualExpiry = policy.manualBoundaryDefaultExpiry ?? "2027-12-31";
  const rows = [];

  for (const row of waivers) {
    rows.push({
      id: `waiver:${row.id}`,
      kind: "external-waiver",
      owner: row.owner ?? null,
      expiry: row.expiry ?? null,
      impact: row.reason ? `${row.risk ?? "unknown"} risk waiver: ${row.reason}` : row.risk ?? null,
      validationCommand: row.validationCommand ?? null,
      blockerClass: row.blockerClass ?? null,
      replacementObjective: row.replacementObjective ?? null,
    });
  }

  for (const row of manualBoundaries.manualActions ?? []) {
    rows.push({
      id: `manual:${row.id}`,
      kind: "manual-boundary",
      owner: residualOwnerForOwnerArea(row.ownerArea),
      expiry: defaultManualExpiry,
      impact: impactByCategory[row.category] ?? row.smallestNextAction ?? null,
      validationCommand: row.readinessCommand ?? null,
      blockerClass: uniqueSorted(row.boundaryClasses ?? []).join(","),
      externalSystem: row.externalSystem ?? null,
    });
  }

  for (const row of threatRows.filter((entry) => entry.status === "na")) {
    rows.push({
      id: `threat-na:${row.id}`,
      kind: "threat-not-applicable",
      owner: row.owner ?? null,
      expiry: row.expiresAt ?? null,
      impact: row.naJustification ?? null,
      validationCommand: "check:threat-row-coverage",
      blockerClass: row.naWaiverId ?? null,
    });
  }

  const requiredFields = policy.requiredFields ?? ["id", "kind", "owner", "expiry", "impact", "validationCommand"];
  const todayMs = Date.parse("2026-05-29T00:00:00.000Z");
  for (const row of rows) {
    for (const field of requiredFields) {
      if (row[field] == null || row[field] === "") issues.push(issue("residual_risk_missing_required_field", { id: row.id, field }));
    }
    const expiryMs = Date.parse(`${row.expiry}T23:59:59.999Z`);
    if (!Number.isNaN(expiryMs) && expiryMs < todayMs) issues.push(issue("residual_risk_expired", { id: row.id, expiry: row.expiry }));
    if (row.validationCommand && !validationCommandExists(scripts, row.validationCommand)) {
      issues.push(issue("residual_risk_missing_validation_command", { id: row.id, validationCommand: row.validationCommand }));
    }
  }

  return {
    riskCount: rows.length,
    byKind: countBy(rows, "kind"),
    byOwner: countBy(rows, "owner"),
    rows: rows.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function buildStrideDreadThreatModelArtifact(report) {
  return {
    version: 2,
    source: "code-owned-stride-dread-threat-model",
    generatedBy: "scripts/check-control-traceability.mjs --write",
    sourceArtifact: ARTIFACT_REL,
    surfaceCount: report.attackSurfaceInventory.rowCount,
    highRiskSurfaceCount: report.attackSurfaceInventory.highRiskSurfaceCount,
    strideCoverage: report.attackSurfaceInventory.strideCoverage,
    surfaces: report.attackSurfaceInventory.rows.map((row) => ({
      id: row.id,
      path: row.route,
      sourcePath: row.sourcePath,
      riskTier: row.riskTier,
      attackSurfaceClasses: row.attackSurfaceClasses,
      trustBoundaries: row.trustBoundaries,
      stride: Object.fromEntries(row.strideCategories.map((category) => [category, row.dread.risk])),
      dread: row.dread,
      owaspControls: row.owaspControls,
      evidence: {
        directTestCount: row.evidence.directTests.length,
        staticChecks: row.evidence.staticChecks.map((entry) => entry.script),
        generatedArtifacts: row.evidence.generatedArtifacts.map((entry) => entry.path),
      },
    })),
  };
}

export function buildOperationalThreatModelControlTraceabilityReport(root = DEFAULT_ROOT, options = {}) {
  const checkDrift = Boolean(options.checkDrift);
  const issues = [];
  const config = readJson(root, CONFIG_REL, {});
  const scripts = packageScripts(root);
  const commandRows = validateConfiguredCommands(root, config, scripts, issues);
  const routeUniverse = readJson(root, "artifacts/route-universe.json", { routes: [] });
  const routeRows = Array.isArray(routeUniverse.routes) ? routeUniverse.routes : [];
  const securityRouteRows = readJson(root, "artifacts/security-route-matrix.json", []);
  const securityControlRows = readJson(root, "artifacts/security-control-coverage-matrix.rows.json", { rows: [] })?.rows ?? [];
  const gdprSoc2Controls = readJson(root, "artifacts/gdpr-soc2-control-map.json", { controls: [] })?.controls ?? [];
  const threatRows = readJson(root, "artifacts/assurance/threat-rows.json", { rows: [] })?.rows ?? [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-threat-model-control-traceability") {
    issues.push(issue("invalid_control_traceability_config_metadata"));
  }

  const securityControlCoverage = analyzeSecurityControlRows(root, config, securityControlRows, issues);
  const frameworkControlCoverage = analyzeFrameworkControlMap(root, gdprSoc2Controls, issues);
  const threatRowCoverage = analyzeThreatRows(root, scripts, threatRows, issues);
  const attackSurfaceInventory = buildAttackSurfaceInventory(root, config, scripts, routeRows, securityRouteRows, issues);
  const minimumChecks = analyzeMinimums(config, attackSurfaceInventory, securityControlCoverage, threatRowCoverage, issues);
  const residualRiskReport = analyzeResidualRisks(root, config, scripts, threatRows, issues);

  const report = {
    ok: false,
    schemaVersion: 1,
    source: "code-owned-operational-threat-model-control-traceability",
    generatedBy: "scripts/check-control-traceability.mjs --write",
    generatedFrom: CONFIG_REL,
    sourceArtifacts: [
      "artifacts/route-universe.json",
      "artifacts/security-route-matrix.json",
      "artifacts/security-control-coverage-matrix.rows.json",
      "artifacts/gdpr-soc2-control-map.json",
      "artifacts/assurance/threat-rows.json",
      "config/qa-external-waiver-registry.json",
      "config/operational-manual-boundaries.json",
    ],
    commandRows,
    minimumChecks,
    securityControlCoverage,
    frameworkControlCoverage,
    threatRowCoverage,
    attackSurfaceInventory,
    residualRiskReport,
    issueCount: 0,
    issues: [],
  };
  report.ok = issues.length === 0;
  report.issueCount = issues.length;
  report.issues = issues;

  const strideDreadThreatModel = buildStrideDreadThreatModelArtifact(report);

  if (checkDrift) {
    const expectedReport = stableStringify(report);
    const actualReport = read(root, ARTIFACT_REL);
    if (!actualReport) {
      issues.push(issue("control_traceability_artifact_missing", { path: ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    } else if (actualReport !== expectedReport) {
      issues.push(issue("control_traceability_artifact_drift", { path: ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    }

    const expectedStride = stableStringify(strideDreadThreatModel);
    const actualStride = read(root, STRIDE_ARTIFACT_REL);
    if (!actualStride) {
      issues.push(issue("stride_dread_threat_model_artifact_missing", { path: STRIDE_ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    } else if (actualStride !== expectedStride) {
      issues.push(issue("stride_dread_threat_model_artifact_drift", { path: STRIDE_ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    }

    report.ok = issues.length === 0;
    report.issueCount = issues.length;
    report.issues = issues;
  }

  return { report, strideDreadThreatModel };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, strict: false, write: false, verbose: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    }
  }
  return options;
}

function summarizeReport(report) {
  return {
    ok: report.ok,
    schemaVersion: report.schemaVersion,
    source: report.source,
    generatedFrom: report.generatedFrom,
    attackSurfaceRows: report.attackSurfaceInventory.rowCount,
    highRiskSurfaceRows: report.attackSurfaceInventory.highRiskSurfaceCount,
    securityControlRows: report.securityControlCoverage.rowCount,
    threatRows: report.threatRowCoverage.rowCount,
    residualRiskRows: report.residualRiskReport.riskCount,
    strideCoverage: report.attackSurfaceInventory.strideCoverage,
    minimumChecks: report.minimumChecks,
    issueCount: report.issueCount,
    issues: report.issues.slice(0, 40),
  };
}

export function runControlTraceabilityCheck(options = parseArgs(process.argv.slice(2))) {
  const { report, strideDreadThreatModel } = buildOperationalThreatModelControlTraceabilityReport(options.root, {
    checkDrift: !options.write,
  });

  if (options.write) {
    writeJson(options.root, ARTIFACT_REL, report);
    writeJson(options.root, STRIDE_ARTIFACT_REL, strideDreadThreatModel);
  }

  console.log(JSON.stringify(options.verbose ? report : summarizeReport(report), null, 2));
  if (options.strict && !report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runControlTraceabilityCheck();
}
