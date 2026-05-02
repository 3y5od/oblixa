/**
 * Debugging sweep catalog types (provenance-driven).
 * Do not import heavy catalog data from client bundles — use `catalog-index.server.ts` on the server.
 */

export type SweepList = "1" | "2" | "3" | "1+2" | "1+3" | "2+3" | "1+2+3";

export type SweepLayer = "product" | "protocol" | "platform" | "people" | "pathology" | "meta";

export type SweepImplementation = "native" | "stub" | "partial";

/** Provenance partition / generator grouping (pass5–pass11, meta, native, middleware). */
export type SweepPartition =
  | "pass5"
  | "pass6"
  | "pass7"
  | "pass8"
  | "pass9"
  | "pass10"
  | "pass11"
  | "meta"
  | "native"
  | "middleware-matrix";

export type SweepDetectability = "auto" | "manual" | "hybrid";

export type SweepBlastRadius = "low" | "med" | "high";

export type SweepPrivacyRisk = "low" | "med" | "high";

export type SbomFormat = "SPDX" | "CycloneDX" | "SWID" | "unknown";

export type ContentAuthenticityHint = "C2PA" | "none" | "unknown";

export interface SweepItem {
  id: string;
  title: string;
  list: SweepList;
  sectionPath: string;
  layer: SweepLayer;
  implementation: SweepImplementation;
  /** Provenance partition for checksums and manifest tests. */
  partition?: SweepPartition;
  /** When true, row is meta (catalog-of-catalog); excluded from bullet-count equality unless explicitly counted. */
  provenanceMeta?: boolean;
  /** @deprecated in catalog consumers when deprecatedBy is set */
  deprecated?: boolean;
  equivalenceGroup?: string;
  deprecatedBy?: string;
  supersedes?: string;
  notes?: string;
  stubClass?: string;
  implementationHint?: string;
  detectability?: SweepDetectability;
  blastRadius?: SweepBlastRadius;
  privacyRisk?: SweepPrivacyRisk;
  tags?: string[];
  cweIds?: string[];
  owaspCategory?: string;
  e2eSpecPaths?: string[];
  relatedArtifactIds?: string[];
  sbomFormat?: SbomFormat;
  referenceUrls?: string[];
  npmPackageName?: string;
  jurisdictionTags?: string[];
  aiGovernanceFramework?: string[];
  contentAuthenticityHint?: ContentAuthenticityHint;
  languageRuntimeTags?: string[];
  peripheralApiTags?: string[];
  filesystemStorageTags?: string[];
  mlOpsToolTags?: string[];
  formalMethodTags?: string[];
  serializationFormatTags?: string[];
  rpcContractTags?: string[];
  nodeRuntimeTags?: string[];
  artifactsPath?: string;
  configPath?: string;
}

export function isSweepItem(x: unknown): x is SweepItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.list === "string" &&
    typeof o.sectionPath === "string" &&
    typeof o.layer === "string" &&
    typeof o.implementation === "string"
  );
}
