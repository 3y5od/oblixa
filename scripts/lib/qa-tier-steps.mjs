/**
 * Shared QA sweep tier step lists for `pipeline-qa-max.mjs` and `report-qa-closure-manifest.mjs`.
 * Keep in sync with product expectations for P0–P10 (single source of truth).
 */
export const p0 = [
  "report:qa-coverage-tier",
  "check:playwright-tag-coverage",
  "check:dangerous-node-patterns",
  "check:github-actions-permissions",
  "check:pull-request-target-hygiene",
  "check:e2e-generated-drift",
  "check:e2e-quarantine",
  "lint",
  "typecheck",
  "test:scripts",
];

export const p1 = [
  "report:qa-coverage-tier",
  "check:playwright-tag-coverage",
  "check:dangerous-node-patterns",
  "check:github-actions-permissions",
  "check:pull-request-target-hygiene",
  "check:dockerfile-presence",
  "check:graphql-surface",
  "check:openapi-route-coverage",
  "check:e2e-generated-drift",
  "check:e2e-quarantine",
  "lint",
  "typecheck",
  "test:scripts",
];

export const p2 = [...p1, "test:logic"];

export const p3 = [...p2, "test:coverage"];

export const p4 = [
  ...p3,
  "report:test-heatmap",
  "check:control-traceability",
  "check:e2e-po-route-coverage",
  "check:red-metrics-json",
  "check:web3-surface-absent",
  "check:notices-bundle",
  "check:ml-lineage-drift",
  "check:subprocessors-privacy-alignment",
  "check:pci-cde-drift",
  "check:sanctions-residency-consistency",
  "check:sanctions-export-consistency",
  "check:locale-coverage-drift",
  "check:pci-row-coverage",
  "check:queue-surface",
  "report:rpo-rto-status",
];

export const p5 = [...p4, "qa:sweep:ultimate:nightly"];
export const p6 = [...p4, "qa:sweep:ultimate:nightly", "qa:sweep:ultimate:release"];
export const p7 = [...p4, "qa:sweep:ultimate:nightly", "qa:sweep:ultimate:release", "qa:sweep:ultimate:postmerge"];
export const p8 = [...p7, "check:qa-maximal-bundle"];
export const p9 = [...p8];
export const p10 = [...p9, "qa:sweep:checks:batch"];

export const QA_TIER_STEPS = {
  P0: p0,
  P1: p1,
  P2: p2,
  P3: p3,
  P4: p4,
  P5: p5,
  P6: p6,
  P7: p7,
  P8: p8,
  P9: p9,
  P10: p10,
};
