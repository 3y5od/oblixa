import "server-only";

import { ALL_SWEEP_ITEMS, CATALOG_GENERATED_HASH } from "./catalog-generated";
import type { SweepItem } from "./catalog-types";
import { HANDWRITTEN_SWEEP_OVERRIDES } from "./catalog-handwritten-overrides";

/** Semver for SweepItem shape and merge policy (MINOR when adding backward-compatible rows). */
export const CATALOG_VERSION = "0.11.0" as const;

/** Stable build fingerprint derived from generated catalog bytes. */
export const INVARIANT_BUILD_ID = CATALOG_GENERATED_HASH.slice(0, 16);

function mergeById(base: readonly SweepItem[], overrides: readonly SweepItem[]): SweepItem[] {
  const map = new Map<string, SweepItem>();
  for (const r of base) map.set(r.id, r);
  for (const r of overrides) map.set(r.id, r);
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function getMergedSweepItems(): readonly SweepItem[] {
  return mergeById(ALL_SWEEP_ITEMS, HANDWRITTEN_SWEEP_OVERRIDES);
}

export function getSweepCatalogStats() {
  const items = getMergedSweepItems();
  const stubClasses = new Set(items.map((i) => i.stubClass).filter(Boolean));
  return {
    catalogVersion: CATALOG_VERSION,
    invariantBuildId: INVARIANT_BUILD_ID,
    rowCount: items.length,
    stubClassCount: stubClasses.size,
    provenanceHash: CATALOG_GENERATED_HASH,
  };
}
