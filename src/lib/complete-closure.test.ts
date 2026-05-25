import { describe, expect, it } from "vitest";
import {
  V10_GA_SAMPLE_SIZES,
  V10_JOB_CLASSES,
  V10_NOTIFICATION_CLASSES,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_SOURCE_OBJECT_TYPES,
} from "./release-contract";
import { V10_RC_FIXTURE_CATEGORIES } from "./objective-measurements";
import { V10_REQUIRED_ACCEPTANCE_IDS } from "./acceptance-matrix";
import { V10_REQUIRED_MUTATION_CONTRACTS } from "./mutation-envelope";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./read-models";
import { V10_ROUTE_API_CATALOG } from "./route-api-catalog";
import { V10_UI_STATE_CONTRACTS } from "./ui-state-contracts";
import {
  buildV10CompleteClosureReport,
  buildV10CompleteClosureRows,
  validateV10CompleteClosureReport,
} from "./complete-closure";
import { V10_DEPRECATION_CLEANUP_DECISIONS } from "./final-gap-audit";
import { V10_OPS_RELEASE_READINESS_CONTRACTS, V10_PROVIDER_BOUNDARIES } from "./operational-contracts";

describe("V10 complete closure", () => {
  it("builds a no-exclusions closure report across every contract family", () => {
    const report = buildV10CompleteClosureReport("2026-01-01T00:00:00.000Z");

    expect(validateV10CompleteClosureReport(report)).toEqual([]);
    expect(report.rows.length).toBeGreaterThan(
      V10_REQUIRED_MUTATION_CONTRACTS.length +
        V10_ROUTE_API_CATALOG.length +
        V10_UI_STATE_CONTRACTS.length
    );
    expect(Object.keys(report.counts).sort()).toEqual([
      "acceptance",
      "job_notification_report_fixture",
      "mutation",
      "no_exclusions",
      "objective_measurement",
      "read_model",
      "release_evidence",
      "route",
      "source_object",
      "ui_state",
    ]);
    expect(report.rows.every((row) => row.releaseEvidenceId.startsWith("v10-complete:"))).toBe(true);
  });

  it("creates row-level coverage for acceptance IDs, source objects, read models, mutations, routes, states, and metrics", () => {
    const rows = buildV10CompleteClosureRows();
    const keysByDomain = new Map<string, Set<string>>();
    for (const row of rows) {
      keysByDomain.set(row.domain, (keysByDomain.get(row.domain) ?? new Set()).add(row.key));
    }

    const mutationKeys = keysByDomain.get("mutation") ?? new Set();
    for (const mutation of V10_REQUIRED_MUTATION_CONTRACTS) {
      expect(mutationKeys.has(mutation.key), mutation.key).toBe(true);
    }

    const routeKeys = keysByDomain.get("route") ?? new Set();
    for (const route of V10_ROUTE_API_CATALOG) {
      expect(routeKeys.has(`${route.path}:${route.methods.join("+")}`), route.path).toBe(true);
    }

    const uiStateKeys = keysByDomain.get("ui_state") ?? new Set();
    for (const state of V10_UI_STATE_CONTRACTS) {
      expect(uiStateKeys.has(state.state), state.state).toBe(true);
    }

    const sourceObjectRow = rows.find((row) => row.domain === "source_object" && row.key === "source_object_inventory");
    const sourceObjectKeys = keysByDomain.get("source_object") ?? new Set();
    expect(sourceObjectRow?.proofArtifacts).toContain("src/lib/source-object-inventory.ts");
    for (const sourceObjectType of V10_SOURCE_OBJECT_TYPES) {
      expect(sourceObjectRow?.failures).not.toContain(`source_object_missing:${sourceObjectType}`);
      expect(sourceObjectKeys.has(sourceObjectType), sourceObjectType).toBe(true);
      expect(rows.find((row) => row.domain === "source_object" && row.key === sourceObjectType)?.status, sourceObjectType).toBe("closed");
    }

    const readModelRow = rows.find((row) => row.domain === "read_model" && row.key === "read_model_runtime_contracts");
    for (const readModelKey of V10_REQUIRED_READ_MODEL_KEYS) {
      expect(readModelRow?.failures).not.toContain(`read_model_missing:${readModelKey}`);
    }

    const acceptanceRow = rows.find((row) => row.domain === "acceptance" && row.key === "acceptance_matrix");
    const acceptanceKeys = keysByDomain.get("acceptance") ?? new Set();
    for (const acceptanceId of V10_REQUIRED_ACCEPTANCE_IDS) {
      expect(acceptanceRow?.failures).not.toContain(`acceptance_id_missing:${acceptanceId}`);
      expect(acceptanceKeys.has(acceptanceId), acceptanceId).toBe(true);
      expect(rows.find((row) => row.domain === "acceptance" && row.key === acceptanceId)?.status, acceptanceId).toBe("closed");
    }

    const objectiveRow = rows.find((row) => row.domain === "objective_measurement");
    const objectiveKeys = keysByDomain.get("objective_measurement") ?? new Set();
    for (const metricKey of Object.keys(V10_GA_SAMPLE_SIZES)) {
      expect(objectiveRow?.failures).not.toContain(`objective_metric_missing:${metricKey}`);
      expect(objectiveKeys.has(metricKey), metricKey).toBe(true);
      expect(rows.find((row) => row.domain === "objective_measurement" && row.key === metricKey)?.status, metricKey).toBe("closed");
    }

    const operationsKeys = keysByDomain.get("job_notification_report_fixture") ?? new Set();
    for (const jobClass of V10_JOB_CLASSES) {
      expect(operationsKeys.has(`job:${jobClass}`), jobClass).toBe(true);
      expect(rows.find((row) => row.domain === "job_notification_report_fixture" && row.key === `job:${jobClass}`)?.status, jobClass).toBe("closed");
    }
    for (const notificationClass of V10_NOTIFICATION_CLASSES) {
      expect(operationsKeys.has(`notification:${notificationClass}`), notificationClass).toBe(true);
      expect(rows.find((row) => row.domain === "job_notification_report_fixture" && row.key === `notification:${notificationClass}`)?.status, notificationClass).toBe("closed");
    }
    for (const fixture of V10_RC_FIXTURE_CATEGORIES) {
      expect(operationsKeys.has(`fixture:${fixture.category}`), fixture.category).toBe(true);
      expect(rows.find((row) => row.domain === "job_notification_report_fixture" && row.key === `fixture:${fixture.category}`)?.status, fixture.category).toBe("closed");
    }
    for (const fixtureMinimum of Object.keys(V10_RELEASE_FIXTURE_MINIMUMS)) {
      expect(operationsKeys.has("job_notification_report_fixture_enums"), fixtureMinimum).toBe(true);
    }

    const noExclusionsKeys = keysByDomain.get("no_exclusions") ?? new Set();
    for (const decision of V10_DEPRECATION_CLEANUP_DECISIONS) {
      expect(noExclusionsKeys.has(`legacy:${decision.candidateId}`), decision.candidateId).toBe(true);
      expect(rows.find((row) => row.domain === "no_exclusions" && row.key === `legacy:${decision.candidateId}`)?.status, decision.candidateId).toBe("closed");
    }

    const releaseEvidenceIds = keysByDomain.get("release_evidence") ?? new Set();
    for (const ops of V10_OPS_RELEASE_READINESS_CONTRACTS) {
      expect(releaseEvidenceIds.has(`ops_dashboard:${ops.key}`), ops.key).toBe(true);
      expect(rows.find((row) => row.domain === "release_evidence" && row.key === `ops_dashboard:${ops.key}`)?.status, ops.key).toBe("closed");
    }
    for (const provider of V10_PROVIDER_BOUNDARIES) {
      expect(releaseEvidenceIds.has(`provider:${provider.provider}`), provider.provider).toBe(true);
      expect(rows.find((row) => row.domain === "release_evidence" && row.key === `provider:${provider.provider}`)?.status, provider.provider).toBe("closed");
    }
  });
});
