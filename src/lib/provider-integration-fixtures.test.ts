import { describe, expect, it } from "vitest";
import {
  PROVIDER_INTEGRATION_FIXTURES,
  REQUIRED_PROVIDER_INTEGRATION_SCENARIOS,
  providerIntegrationFixtureIssues,
} from "@/lib/provider-integration-fixtures";

describe("provider integration fixtures", () => {
  it("covers every required provider scenario with tenant-scoped replay-safe sanitized diagnostics", () => {
    expect(providerIntegrationFixtureIssues()).toEqual([]);
    for (const [family, scenarios] of Object.entries(REQUIRED_PROVIDER_INTEGRATION_SCENARIOS)) {
      const present = PROVIDER_INTEGRATION_FIXTURES
        .filter((fixture) => fixture.family === family)
        .map((fixture) => fixture.scenario);
      expect(new Set(present)).toEqual(new Set(scenarios));
    }
  });

  it("reports missing scenarios and unsafe fixture metadata", () => {
    expect(
      providerIntegrationFixtureIssues([
        {
          id: "unsafe",
          family: "stripe",
          scenario: "checkout_completed",
          expectedOutcome: "accepted",
          tenantScoped: false,
          replaySafe: false,
          sanitizedDiagnostics: false,
        },
      ])
    ).toEqual(expect.arrayContaining([
      "unsafe:tenant_scope_required",
      "unsafe:replay_safety_required",
      "unsafe:sanitized_diagnostics_required",
      "stripe:portal_return:missing",
    ]));
  });
});
