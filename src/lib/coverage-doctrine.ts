/**
 * V10 maximal-coverage doctrine: owner dimensions for release evidence and CI gates.
 * See plan §0 — each dimension must have a named engineering owner before GA promotion.
 */
export const V10_COVERAGE_DIMENSION_OWNERS = [
  { dimension: "product_surfaces", ownerRole: "engineering", proofArtifacts: ["src/app/(dashboard)", "e2e/current-product-core-smoke.spec.ts"] },
  { dimension: "runtime_data", ownerRole: "engineering", proofArtifacts: ["src/lib/read-model-refresh.ts", "supabase/migrations/057_v10_runtime_contracts.sql"] },
  { dimension: "security_privacy", ownerRole: "security", proofArtifacts: ["src/lib/hardening-contracts.ts", "src/lib/server-contracts.ts", "semgrep/oblixa-v10-surface.yml"] },
  { dimension: "performance", ownerRole: "engineering", proofArtifacts: ["src/lib/ui-state-contracts.ts", "src/lib/route-api-catalog.ts"] },
  { dimension: "qa_automation", ownerRole: "engineering", proofArtifacts: ["scripts/check-release-suite-current.mjs", "src/**/*.v10.test.ts"] },
  { dimension: "release", ownerRole: "release", proofArtifacts: ["src/lib/release-evidence.ts", "scripts/check-release-promotable.mjs"] },
] as const;

export function validateV10CoverageDimensionOwners(): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of V10_COVERAGE_DIMENSION_OWNERS) {
    if (seen.has(row.dimension)) failures.push(`duplicate_dimension:${row.dimension}`);
    seen.add(row.dimension);
    if (!row.ownerRole.trim()) failures.push(`missing_owner:${row.dimension}`);
    const artifacts = row.proofArtifacts as readonly string[];
    if (artifacts.length === 0) failures.push(`missing_proof_artifact:${row.dimension}`);
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V10_COVERAGE_DIMENSION_OWNERS as COVERAGE_DIMENSION_OWNERS };
export { validateV10CoverageDimensionOwners as validateCoverageDimensionOwners };
// End version-name compatibility aliases.
