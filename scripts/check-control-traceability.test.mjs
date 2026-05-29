import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOperationalThreatModelControlTraceabilityReport,
  classifyAttackSurface,
  mapStrideThreats,
} from "./check-control-traceability.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-control-traceability-"));
}

function writeText(root, rel, text = "") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function writeJson(root, rel, value) {
  writeText(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

const REQUIRED_SCRIPTS = [
  "check:control-traceability:strict",
  "check:api-route-auth-contract",
  "check:api-route-rate-limit-coverage",
  "check:security-route-matrix",
  "check:webhook-inbound-policy",
  "check:operational-webhooks-callbacks",
  "check:csrf-surface-guards",
  "check:idempotency-policy",
  "check:security-control-coverage",
  "check:operational-rate-limits-abuse-bounds",
  "check:operational-provider-integrations",
  "check:security-fetch-sinks:strict",
];

function writeMinimalFixture(root, overrides = {}) {
  const scripts = Object.fromEntries(REQUIRED_SCRIPTS.map((script) => [script, `echo ${script}`]));
  writeJson(root, "package.json", { scripts });
  writeText(root, ".github/workflows/ci.yml", "run: npm run check:control-traceability:strict\n");
  writeJson(root, "config/operational-threat-model-control-traceability.json", {
    schemaVersion: 1,
    source: "code-owned-operational-threat-model-control-traceability",
    objectives: [
      {
        id: "traceability",
        ownerArea: "platform-security",
        commands: [{ command: "check:control-traceability:strict", ciRequired: true, covers: ["traceability"] }],
        artifacts: ["artifacts/security-control-coverage-matrix.rows.json"],
      },
    ],
    minimums: {
      attackSurfaceRows: 1,
      highRiskSurfaceRows: 1,
      securityControlRows: 1,
      threatRows: 0,
    },
    requiredStrideCategories: ["spoofing", "tampering", "repudiation", "denial-of-service"],
    requiredOwaspApiControls: ["SEC-API1"],
    requiredAttackSurfaceClasses: ["webhook", "provider-call"],
    highRiskTiers: ["P0", "P1"],
    residualRiskPolicy: {
      manualBoundaryDefaultExpiry: "2027-12-31",
      requiredFields: ["id", "kind", "owner", "expiry", "impact", "validationCommand"],
      impactByManualBoundaryCategory: {},
    },
  });
  writeJson(root, "artifacts/route-universe.json", {
    routes: [
      {
        id: "api_route:/api/stripe/webhook:src/app/api/stripe/webhook/route.ts",
        route: "/api/stripe/webhook",
        sourcePath: "src/app/api/stripe/webhook/route.ts",
        kind: "api_route",
        class: "webhook",
        methods: ["POST"],
        authModel: "webhook_signature",
        rolePolicy: ["webhook_signature"],
        rateLimitPolicy: "webhook",
        bodyPolicy: "signature_bound_raw_body",
        cachePolicy: "private_no_store",
        owner: "integrations",
        riskTier: "P0",
        providers: ["stripe"],
        dbDependencies: { tables: [], rpcs: [] },
        dynamicSegments: [],
        orgScopeRequired: false,
        orgScopeEvidence: false,
        observabilityRequired: true,
      },
    ],
  });
  writeJson(root, "artifacts/security-route-matrix.json", [
    {
      path: "/api/stripe/webhook",
      method: "POST",
      route_file: "src/app/api/stripe/webhook/route.ts",
      audit_event_expectation: "explicit_audit_event",
      csrf_origin_policy: "signature_validated",
      idempotency_or_job_lock_policy: "provider_event_replay_guard",
      sec_ids: ["SEC-API1"],
    },
  ]);
  writeJson(root, "artifacts/security-control-coverage-matrix.rows.json", {
    rows: [
      {
        sec_id: "SEC-API1",
        title: "OWASP API1",
        I_refs: "",
        T_refs: "",
        E_refs: "scripts/check-api-route-auth-contract.mjs",
        M_refs: "manual evidence",
        priority: "P0",
        owner_team: "security",
      },
    ],
  });
  writeText(root, "scripts/check-api-route-auth-contract.mjs", "");
  writeJson(root, "artifacts/gdpr-soc2-control-map.json", { controls: [] });
  writeJson(root, "artifacts/assurance/threat-rows.json", { rows: [] });
  writeJson(root, "config/qa-external-waiver-registry.json", { waivers: overrides.waivers ?? [] });
  writeJson(root, "config/operational-manual-boundaries.json", { manualActions: overrides.manualActions ?? [] });
}

test("classifies webhook provider routes as high-risk attack surfaces", () => {
  const row = {
    route: "/api/stripe/webhook",
    kind: "api_route",
    class: "webhook",
    methods: ["POST"],
    authModel: "webhook_signature",
    providers: ["stripe"],
    bodyPolicy: "signature_bound_raw_body",
  };

  assert.deepEqual(classifyAttackSurface(row), ["provider-call", "webhook"]);
  assert.deepEqual(mapStrideThreats(row), ["spoofing", "tampering", "repudiation", "information-disclosure", "denial-of-service"]);
});

test("builds a complete control traceability report for a high-risk webhook", () => {
  const root = makeRoot();
  writeMinimalFixture(root);

  const { report, strideDreadThreatModel } = buildOperationalThreatModelControlTraceabilityReport(root);
  assert.equal(report.ok, true);
  assert.equal(report.attackSurfaceInventory.highRiskSurfaceCount, 1);
  assert.equal(report.securityControlCoverage.requiredOwaspApiControls[0].present, true);
  assert.equal(strideDreadThreatModel.surfaceCount, 1);
  assert.equal(strideDreadThreatModel.surfaces[0].path, "/api/stripe/webhook");
});

test("residual risk rows must include owner expiry impact and validation command", () => {
  const root = makeRoot();
  writeMinimalFixture(root, {
    waivers: [
      {
        id: "bad-waiver",
        owner: "@security",
        reason: "",
        validationCommand: "check:control-traceability:strict",
      },
    ],
  });

  const { report } = buildOperationalThreatModelControlTraceabilityReport(root);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((entry) => entry.issue === "residual_risk_missing_required_field" && entry.field === "expiry"));
  assert.ok(report.issues.some((entry) => entry.issue === "residual_risk_missing_required_field" && entry.field === "impact"));
});
