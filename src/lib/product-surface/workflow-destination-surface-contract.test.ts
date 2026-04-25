import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { featureFamilyForPath } from "@/lib/product-surface/feature-registry";
import { inventoryTierForPath } from "@/lib/product-surface/route-inventory";
import {
  WORKFLOW_DESTINATIONS,
  buildWorkflowDestinationManifest,
  listWorkflowDestinationsForSurface,
  workflowDestinationForHref,
} from "@/lib/product-surface/workflow-destinations";

const FLAGS = {
  v5DecisionFoundation: true,
  v5PortfolioCampaigns: true,
  v5SimulationAndIntelligence: true,
  v5RelationshipLayer: true,
  v5ExternalCollaboration: true,
  v5ControlRoomUx: true,
  v6AssuranceCore: true,
  v6ControlPolicies: true,
  v6AdaptivePlaybooks: true,
  v6Autopilot: true,
  v6OutcomeIntelligence: true,
  v6ReviewBoards: true,
  v6Segments: true,
} satisfies Partial<Record<FeatureFlagKey, boolean>>;

function surface(mode: "core" | "advanced" | "assurance") {
  return buildProductSurfaceContext({
    orgId: "org_contract",
    role: "admin",
    v6: { workspace_mode: mode },
    featureFlags: FLAGS as Record<FeatureFlagKey, boolean>,
  });
}

function pathOnly(href: string): string {
  return href.split(/[?#]/)[0] ?? href;
}

describe("workflow destination surface contract", () => {
  it("keeps page destinations aligned with route inventory or registry ownership", () => {
    for (const destination of WORKFLOW_DESTINATIONS) {
      if (!destination.href.startsWith("/") || destination.href.startsWith("/api/")) continue;
      const path = pathOnly(destination.href);
      expect(
        inventoryTierForPath(path) ?? featureFamilyForPath(path),
        `${destination.key}:${destination.href}`
      ).toBeTruthy();
    }
  });

  it("does not include Advanced or Assurance destinations in the Core manifest", () => {
    const manifest = buildWorkflowDestinationManifest(surface("core"));
    expect(manifest.map((row) => row.key)).not.toContain("decisions");
    expect(manifest.map((row) => row.key)).not.toContain("assurance");
    expect(manifest.every((row) => !row.label.toLowerCase().includes("portfolio"))).toBe(true);
  });

  it("normalizes query and hash URLs through registered destination labels", () => {
    expect(workflowDestinationForHref("/work?lens=blocked#tasks")?.key).toBe("work");
    expect(workflowDestinationForHref("/reports#assurance-analytics")?.key).toBe(
      "assurance_analytics"
    );
  });

  it("omits raw org/user/token data from generated manifests", () => {
    const manifestText = JSON.stringify(buildWorkflowDestinationManifest(surface("assurance")));
    expect(manifestText).not.toContain("org_contract");
    expect(manifestText).not.toMatch(/token|secret|email|contract_text/i);
  });

  it("keeps destination copy within compact layout budgets", () => {
    for (const destination of WORKFLOW_DESTINATIONS) {
      for (const [mode, copy] of Object.entries(destination.copyByMode)) {
        expect(copy.label.length, `${destination.key}:${mode}:label`).toBeLessThanOrEqual(32);
        expect(copy.description.length, `${destination.key}:${mode}:description`).toBeLessThanOrEqual(
          140
        );
        expect(copy.ctaLabel?.length ?? 0, `${destination.key}:${mode}:cta`).toBeLessThanOrEqual(40);
      }
    }
  });

  it("keeps visible destinations accessible after same-session mode changes", () => {
    const coreHrefs = new Set(listWorkflowDestinationsForSurface(surface("core")).map((d) => d.href));
    const advancedHrefs = listWorkflowDestinationsForSurface(surface("advanced")).map((d) => d.href);
    const assuranceHrefs = listWorkflowDestinationsForSurface(surface("assurance")).map((d) => d.href);
    expect(advancedHrefs).toEqual(expect.arrayContaining([...coreHrefs]));
    expect(assuranceHrefs).toEqual(expect.arrayContaining(advancedHrefs));
  });

  it("treats API/export destinations as contextual capabilities only", () => {
    const apiDestinations = WORKFLOW_DESTINATIONS.filter((destination) =>
      destination.href.startsWith("/api/")
    );
    expect(apiDestinations.map((destination) => destination.key)).toEqual([
      "calendar_export",
      "review_packets",
    ]);
    for (const destination of apiDestinations) {
      expect(destination.placementsByMode.core).not.toContain("primary");
      expect(destination.placementsByMode.advanced).not.toContain("primary");
      expect(destination.placementsByMode.assurance).not.toContain("primary");
    }
  });
});

