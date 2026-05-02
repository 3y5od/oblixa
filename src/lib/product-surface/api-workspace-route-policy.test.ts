import { describe, expect, it } from "vitest";
import {
  featureFamilyForApiPath,
  featureRegistryByKey,
  PRODUCT_FEATURE_REGISTRY,
} from "@/lib/product-surface/feature-registry";

describe("API workspace route policy matrix", () => {
  it("keeps script policy prefixes aligned with feature-registry minimum mode", async () => {
    const policyMod = await import("../../../scripts/lib/api-workspace-route-policy.mjs");
    const registry = featureRegistryByKey();
    const samplePathByPrefix: Record<string, string> = {
      "/api/external-actions/": "/api/external-actions/create-link",
      "/api/decisions/": "/api/decisions",
      "/api/campaigns/": "/api/campaigns",
      "/api/programs/": "/api/programs",
      "/api/simulations/": "/api/simulations/run",
      "/api/intelligence/": "/api/intelligence/portfolio-signals",
      "/api/capacity/": "/api/capacity/forecast",
      "/api/maintenance/": "/api/maintenance/campaigns",
      "/api/accounts/": "/api/accounts/__key__/summary",
      "/api/counterparties/": "/api/counterparties/__key__/summary",
      "/api/assurance/": "/api/assurance/findings",
      "/api/autopilot/": "/api/autopilot/runs",
      "/api/playbooks/": "/api/playbooks",
      "/api/control-policies/": "/api/control-policies",
      "/api/review-boards/": "/api/review-boards",
      "/api/segments/": "/api/segments",
      "/api/program-evolution/": "/api/program-evolution/experiments",
      "/api/outcomes/": "/api/outcomes/interventions",
      "/api/policy/": "/api/policy/simulate",
      "/api/events/": "/api/events",
      "/api/integrations/": "/api/integrations/oauth/start",
      "/api/attestations/": "/api/attestations/run",
      "/api/approvals/": "/api/approvals/sla-metrics",
      "/api/report-packs/": "/api/report-packs",
      "/api/export/contracts": "/api/export/contracts",
      "/api/command-palette/": "/api/command-palette/contracts",
      "/api/evidence/": "/api/evidence/submit",
      "/api/exceptions/": "/api/exceptions",
      "/api/renewals/": "/api/renewals/portfolio-signals",
      "/api/import/": "/api/import/contracts",
      "/api/extract/": "/api/extract",
      "/api/workspace/": "/api/workspace/v6-settings",
      "/api/templates/": "/api/templates/preview",
      "/api/command-centers/": "/api/command-centers/preferences",
    };
    for (const row of policyMod.API_WORKSPACE_GUARD_FAMILIES as Array<{
      prefix: string;
      minMode: "core" | "advanced" | "assurance";
    }>) {
      const samplePath = samplePathByPrefix[row.prefix] ?? `${row.prefix}__probe`;
      const family = featureFamilyForApiPath(samplePath);
      expect(family).not.toBeNull();
      const def = family ? registry.get(family) : null;
      expect(def).toBeTruthy();
      expect(def?.minWorkspaceMode).toBe(row.minMode);
    }
  });

  it("covers every advanced/assurance api prefix from the registry", async () => {
    const policyMod = await import("../../../scripts/lib/api-workspace-route-policy.mjs");
    const policyPrefixes = new Set(
      (policyMod.API_WORKSPACE_GUARD_FAMILIES as Array<{ prefix: string }>).map((row) => row.prefix)
    );

    for (const row of PRODUCT_FEATURE_REGISTRY) {
      if (row.minWorkspaceMode === "core") continue;
      for (const prefix of row.apiPrefixes) {
        if (!prefix.startsWith("/")) continue;
        const apiPrefix = `/api${prefix}/`;
        const hasMatch = [...policyPrefixes].some(
          (policyPrefix) =>
            apiPrefix === policyPrefix ||
            apiPrefix.startsWith(policyPrefix) ||
            policyPrefix.startsWith(apiPrefix)
        );
        expect(
          hasMatch,
          `Missing policy guard prefix for non-core API prefix: ${apiPrefix}`
        ).toBe(true);
      }
    }
  });
});
