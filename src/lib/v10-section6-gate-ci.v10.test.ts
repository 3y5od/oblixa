import { describe, expect, it } from "vitest";
import { V10_ACCEPTANCE_GATES } from "./v10-release-contract";

/**
 * §6.1–§6.16 gate → primary automated verification surface (CI ratchet).
 * Extend this map when new gate-specific suites land; keep commands runnable locally.
 */
const V10_SECTION6_GATE_CI: Record<(typeof V10_ACCEPTANCE_GATES)[number], readonly string[]> = {
  activation: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npx vitest run src/app/api/import/contracts/route.test.ts"],
  work: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npm run test:e2e:v10"],
  contract_record: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npm run test:e2e:v10"],
  review_data_quality: ["npx vitest run src/lib/v10-semantics.v10.test.ts"],
  renewal: ["npx vitest run src/lib/v10-semantics.v10.test.ts"],
  evidence: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npx vitest run src/app/api/cron/v4/evidence-followup/route.test.ts"],
  approval_exception: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npx vitest run src/lib/v10-operational-contracts.v10.test.ts"],
  search: ["npx vitest run src/lib/v10-route-api-catalog.v10.test.ts", "npx vitest run src/components/layout/command-palette.ui.test.tsx"],
  reporting: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npx vitest run src/lib/v10-read-model-refresh.v10.test.ts"],
  workspace_governance: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npx vitest run src/actions/product-surface-settings.test.ts"],
  reliability: ["npx vitest run src/lib/v10-semantics.v10.test.ts", "npx vitest run src/lib/v10-job-visibility.v10.test.ts"],
  security_privacy: ["npx vitest run src/lib/v10-hardening-contracts.v10.test.ts", "npx vitest run src/lib/v10-data-contracts.v10.test.ts"],
  accessibility: ["npx vitest run src/lib/v10-ui-state-contracts.v10.test.ts", "npm run test:e2e:v10"],
  performance: ["npx vitest run src/lib/v10-route-api-catalog.v10.test.ts", "npx vitest run src/lib/v10-performance-budget-contract.v10.test.ts"],
  data_contract: ["npx vitest run src/lib/v10-data-contracts.v10.test.ts", "npx vitest run src/lib/v10-read-model-refresh.v10.test.ts"],
  objective_measurement: ["npx vitest run src/lib/v10-release-evidence.v10.test.ts", "npm run check:v10-release-evidence"],
};

describe("V10 §6 gate CI matrix", () => {
  it("defines at least one verification command per acceptance gate", () => {
    for (const gate of V10_ACCEPTANCE_GATES) {
      const cmds = V10_SECTION6_GATE_CI[gate];
      expect(cmds?.length ?? 0, gate).toBeGreaterThan(0);
    }
  });
});
