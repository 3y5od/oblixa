import { describe, expect, it } from "vitest";
import {
  PRODUCT_FEATURE_REGISTRY,
  type FeatureFamilyKey,
  type ProductFeatureDef,
} from "@/lib/product-surface/feature-registry";
describe("PRODUCT_FEATURE_REGISTRY row contract (§9.1)", () => {
  it("defines identifiers, mode, lifecycle, and at least one route or api prefix", () => {
    const keys = new Set<FeatureFamilyKey>();
    for (const row of PRODUCT_FEATURE_REGISTRY) {
      expect(row.key.length).toBeGreaterThan(0);
      expect(keys.has(row.key), `duplicate registry key ${row.key}`).toBe(false);
      keys.add(row.key);

      expect(row.label.trim().length).toBeGreaterThan(0);
      expect(row.parentDomain).toMatch(/^(core|advanced|assurance|utility)$/);
      expect(row.minWorkspaceMode).toMatch(/^(core|advanced|assurance)$/);
      expect(row.lifecycle.length).toBeGreaterThan(0);
      expect(row.defaultFeatureState.length).toBeGreaterThan(0);

      const hasRouteOrApi = row.routePrefixes.length > 0 || row.apiPrefixes.length > 0;
      expect(hasRouteOrApi, `${row.key} needs routePrefixes and/or apiPrefixes`).toBe(true);
    }
  });
});

function assertCommandVocabularyWhenNav(row: ProductFeatureDef): void {
  if (row.topLevelNavAllowed || row.globalSearchAllowed) {
    expect(
      (row.commandVocabulary?.length ?? 0) > 0 ||
        row.routePrefixes.length > 0 ||
        row.apiPrefixes.length > 0,
      `${row.key}: nav/search-visible rows should define commandVocabulary or route/api prefixes`
    ).toBe(true);
  }
}

describe("PRODUCT_FEATURE_REGISTRY navigation vocabulary hints", () => {
  it("ties discoverable primary/search surfaces to vocabulary or route prefixes", () => {
    for (const row of PRODUCT_FEATURE_REGISTRY) {
      assertCommandVocabularyWhenNav(row);
    }
  });
});
