import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_ADDITIVE_SCHEMA_GUARDRAILS,
  OPERATIONAL_COMPATIBILITY_CONTRACT_SURFACES,
  OPERATIONAL_DEPRECATION_SUNSET_CONTRACTS,
  OPERATIONAL_SCHEMA_COMPATIBILITY_CONFIG,
  buildDualWritePayload,
  resolveDualReadValue,
} from "@/lib/operational-schema-compatibility";

const REQUIRED_SURFACES = [
  "route-paths",
  "query-params",
  "request-bodies",
  "response-fields",
  "csv-headers",
  "pdf-fields",
  "email-template-variables",
  "telemetry-event-names",
  "sql-objects",
  "storage-paths",
  "webhook-event-fields",
  "env-keys",
  "package-scripts",
  "dom-test-selectors",
] as const;

const REQUIRED_GUARDRAILS = [
  "destructive-field-removal",
  "enum-narrowing",
  "response-shape-narrowing",
  "sql-column-drop",
  "sql-policy-change",
  "persisted-event-name-change",
] as const;

const REQUIRED_DEPRECATION_KINDS = [
  "api_field",
  "route",
  "package_script_alias",
  "telemetry_event",
  "env_alias",
  "sql_alias",
  "export_field",
] as const;

describe("operational schema compatibility registry", () => {
  it("inventories every persisted compatibility surface with removal protection", () => {
    const ids = new Set(OPERATIONAL_COMPATIBILITY_CONTRACT_SURFACES.map((surface) => surface.id));

    for (const id of REQUIRED_SURFACES) {
      expect(ids.has(id)).toBe(true);
    }

    for (const surface of OPERATIONAL_COMPATIBILITY_CONTRACT_SURFACES) {
      expect(surface.ownerArea).toMatch(/\S/);
      expect(surface.contractClass).toMatch(/\S/);
      expect(surface.inventorySource).toMatch(/\S/);
      expect(surface.validationCommand).toMatch(/^check:/);
      expect(surface.removalProtection).toMatch(/\S/);
      expect(surface.protectionEvidence.length).toBeGreaterThan(0);
      expect(surface.protectionEvidence.some((entry) => ["alias", "dual-read", "dual-write", "migration", "queue"].includes(entry))).toBe(
        true
      );
    }
  });

  it("enforces additive-first guardrail coverage for destructive schema changes", () => {
    const ids = new Set(OPERATIONAL_ADDITIVE_SCHEMA_GUARDRAILS.map((guardrail) => guardrail.id));

    for (const id of REQUIRED_GUARDRAILS) {
      expect(ids.has(id)).toBe(true);
    }

    for (const guardrail of OPERATIONAL_ADDITIVE_SCHEMA_GUARDRAILS) {
      expect(guardrail.breakingChangeClass).toMatch(/\S/);
      expect(guardrail.detection).toMatch(/\S/);
      expect(guardrail.requiredEvidence).toMatch(/alias|dual-read|dual-write|migration|queue|equivalence/i);
      expect(guardrail.validationCommand).toMatch(/^check:/);
      expect(guardrail.manualBoundaryClassification).toMatch(/\S/);
    }
  });

  it("keeps deprecation metadata complete for every contract kind", () => {
    const kinds = new Set(OPERATIONAL_DEPRECATION_SUNSET_CONTRACTS.map((contract) => contract.kind));

    for (const kind of REQUIRED_DEPRECATION_KINDS) {
      expect(kinds.has(kind)).toBe(true);
    }

    for (const contract of OPERATIONAL_DEPRECATION_SUNSET_CONTRACTS) {
      expect(contract.deprecatedName).toMatch(/\S/);
      expect(contract.replacement).toMatch(/\S/);
      expect(contract.owner).toMatch(/\S/);
      expect(Date.parse(contract.firstDeprecatedOn)).toBeGreaterThan(0);
      expect(Date.parse(contract.earliestRemovalBoundary)).toBeGreaterThan(Date.parse(contract.firstDeprecatedOn));
      expect(contract.validationCommand).toMatch(/^check:/);
      expect(contract.customerImpactClass).toMatch(/customer-visible|external-integrator|internal|none|operator/);
    }
  });

  it("declares OpenAPI parity comparisons for paths, methods, schemas, examples, auth, errors, and deprecations", () => {
    expect(OPERATIONAL_SCHEMA_COMPATIBILITY_CONFIG.openApiParity.requiredComparisons).toEqual([
      "paths",
      "methods",
      "schemas",
      "examples",
      "auth-notes",
      "error-shapes",
      "deprecation-metadata",
    ]);
    expect(OPERATIONAL_SCHEMA_COMPATIBILITY_CONFIG.openApiParity.validationCommands).toEqual([
      "check:openapi-spec-contract",
      "check:openapi-route-coverage",
      "check:openapi-yaml-integrity",
    ]);
  });
});

describe("dual-read and dual-write transitions", () => {
  it("preserves old-only persisted data", () => {
    expect(resolveDualReadValue({ oldValue: "legacy" })).toEqual({
      value: "legacy",
      source: "old",
      conflict: false,
      backfillReady: false,
      reason: "old_only",
    });
  });

  it("uses new-only data when the new field is present", () => {
    expect(resolveDualReadValue({ newValue: "current" })).toMatchObject({
      value: "current",
      source: "new",
      reason: "new_only",
    });
  });

  it("handles equal values present in both old and new fields", () => {
    expect(resolveDualReadValue({ oldValue: "same", newValue: "same" })).toMatchObject({
      value: "same",
      source: "both",
      conflict: false,
      reason: "both_equal",
    });
  });

  it("uses deterministic precedence for conflicting values", () => {
    expect(resolveDualReadValue({ oldValue: "old", newValue: "new" })).toMatchObject({
      value: "new",
      source: "both",
      conflict: true,
      reason: "conflict_prefer_new",
    });
    expect(resolveDualReadValue({ oldValue: "old", newValue: "new", conflictStrategy: "prefer-old" })).toMatchObject({
      value: "old",
      source: "both",
      conflict: true,
      reason: "conflict_prefer_old",
    });
    expect(() => resolveDualReadValue({ oldValue: "old", newValue: "new", conflictStrategy: "error" })).toThrow(
      "dual_read_conflict"
    );
  });

  it("treats null as a present persisted value", () => {
    expect(resolveDualReadValue<string>({ oldValue: null })).toMatchObject({
      value: null,
      source: "old",
      reason: "old_only",
    });
    expect(resolveDualReadValue<string>({ oldValue: "old", newValue: null })).toMatchObject({
      value: null,
      conflict: true,
      reason: "conflict_prefer_new",
    });
  });

  it("emits dual-write payloads until backfill is ready", () => {
    expect(buildDualWritePayload({ oldField: "legacy_name", newField: "name", value: "Acme" })).toEqual({
      legacy_name: "Acme",
      name: "Acme",
    });
    expect(buildDualWritePayload({ oldField: "legacy_name", newField: "name", value: "Acme", backfillReady: true })).toEqual({
      name: "Acme",
    });
    expect(resolveDualReadValue({ oldValue: "legacy", backfillReady: true })).toMatchObject({
      value: "legacy",
      backfillReady: true,
    });
  });
});
