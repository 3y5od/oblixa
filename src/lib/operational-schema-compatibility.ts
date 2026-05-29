import operationalSchemaCompatibilityConfig from "../../config/operational-schema-compatibility.json";

export type CompatibilityProtectionEvidence =
  | "alias"
  | "dual-read"
  | "dual-write"
  | "migration"
  | "queue";

export type OperationalCompatibilityContractSurface = {
  id: string;
  ownerArea: string;
  contractClass: string;
  inventorySource: string;
  validationCommand: string;
  removalProtection: string;
  protectionEvidence: readonly CompatibilityProtectionEvidence[];
};

export type AdditiveSchemaGuardrail = {
  id: string;
  breakingChangeClass: string;
  detection: string;
  requiredEvidence: string;
  validationCommand: string;
  manualBoundaryClassification: string;
};

export type DeprecationContractKind =
  | "api_field"
  | "route"
  | "package_script_alias"
  | "telemetry_event"
  | "env_alias"
  | "sql_alias"
  | "export_field";

export type CustomerImpactClass =
  | "customer-visible"
  | "external-integrator"
  | "internal"
  | "none"
  | "operator";

export type DeprecationSunsetContract = {
  id: string;
  kind: DeprecationContractKind;
  deprecatedName: string;
  replacement: string;
  owner: string;
  firstDeprecatedOn: string;
  earliestRemovalBoundary: string;
  validationCommand: string;
  customerImpactClass: CustomerImpactClass;
};

export type OperationalSchemaCompatibilityConfig = {
  schemaVersion: 1;
  source: "code-owned-operational-schema-compatibility";
  generatedArtifact: string;
  sourceFiles: readonly string[];
  requiredValidationCommands: readonly string[];
  contractSurfaces: readonly OperationalCompatibilityContractSurface[];
  additiveSchemaGuardrails: readonly AdditiveSchemaGuardrail[];
  dualReadTransitionCases: readonly string[];
  deprecationContracts: readonly DeprecationSunsetContract[];
  openApiParity: {
    specPath: string;
    routeInventoryPath: string;
    validationCommands: readonly string[];
    requiredComparisons: readonly string[];
    absencePolicy: string;
  };
  sourceArtifacts: readonly string[];
};

export type DualReadSource = "both" | "new" | "none" | "old";
export type DualReadConflictStrategy = "error" | "prefer-new" | "prefer-old";

export type DualReadInput<T> = {
  oldValue?: T | null;
  newValue?: T | null;
  conflictStrategy?: DualReadConflictStrategy;
  backfillReady?: boolean;
  isEqual?: (oldValue: T | null, newValue: T | null) => boolean;
};

export type DualReadResult<T> = {
  value: T | null;
  source: DualReadSource;
  conflict: boolean;
  backfillReady: boolean;
  reason:
    | "both_absent"
    | "both_equal"
    | "conflict_prefer_new"
    | "conflict_prefer_old"
    | "new_only"
    | "old_only";
};

export type DualWriteInput<T> = {
  oldField: string;
  newField: string;
  value: T | null;
  backfillReady?: boolean;
};

export const OPERATIONAL_SCHEMA_COMPATIBILITY_CONFIG =
  operationalSchemaCompatibilityConfig as OperationalSchemaCompatibilityConfig;

export const OPERATIONAL_COMPATIBILITY_CONTRACT_SURFACES =
  OPERATIONAL_SCHEMA_COMPATIBILITY_CONFIG.contractSurfaces;

export const OPERATIONAL_ADDITIVE_SCHEMA_GUARDRAILS =
  OPERATIONAL_SCHEMA_COMPATIBILITY_CONFIG.additiveSchemaGuardrails;

export const OPERATIONAL_DEPRECATION_SUNSET_CONTRACTS =
  OPERATIONAL_SCHEMA_COMPATIBILITY_CONFIG.deprecationContracts;

function hasPresentValue<T>(input: DualReadInput<T>, key: "newValue" | "oldValue"): boolean {
  return Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;
}

function defaultEqual<T>(oldValue: T | null, newValue: T | null): boolean {
  return Object.is(oldValue, newValue);
}

export function resolveDualReadValue<T>(input: DualReadInput<T>): DualReadResult<T> {
  const hasOld = hasPresentValue(input, "oldValue");
  const hasNew = hasPresentValue(input, "newValue");
  const oldValue = hasOld ? input.oldValue ?? null : null;
  const newValue = hasNew ? input.newValue ?? null : null;
  const backfillReady = Boolean(input.backfillReady);

  if (!hasOld && !hasNew) {
    return {
      value: null,
      source: "none",
      conflict: false,
      backfillReady,
      reason: "both_absent",
    };
  }

  if (hasNew && !hasOld) {
    return {
      value: newValue,
      source: "new",
      conflict: false,
      backfillReady,
      reason: "new_only",
    };
  }

  if (hasOld && !hasNew) {
    return {
      value: oldValue,
      source: "old",
      conflict: false,
      backfillReady,
      reason: "old_only",
    };
  }

  const isEqual = input.isEqual ?? defaultEqual;
  if (isEqual(oldValue, newValue)) {
    return {
      value: newValue,
      source: "both",
      conflict: false,
      backfillReady,
      reason: "both_equal",
    };
  }

  const conflictStrategy = input.conflictStrategy ?? "prefer-new";
  if (conflictStrategy === "error") {
    throw new Error("dual_read_conflict");
  }

  if (conflictStrategy === "prefer-old") {
    return {
      value: oldValue,
      source: "both",
      conflict: true,
      backfillReady,
      reason: "conflict_prefer_old",
    };
  }

  return {
    value: newValue,
    source: "both",
    conflict: true,
    backfillReady,
    reason: "conflict_prefer_new",
  };
}

export function buildDualWritePayload<T>(input: DualWriteInput<T>): Record<string, T | null> {
  if (input.backfillReady) {
    return {
      [input.newField]: input.value,
    };
  }

  return {
    [input.oldField]: input.value,
    [input.newField]: input.value,
  };
}
