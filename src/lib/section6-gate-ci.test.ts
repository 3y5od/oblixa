import { describe, expect, it } from "vitest";
import { V10_ACCEPTANCE_GATES } from "./release-contract";

/**
 * §6.1–§6.16 gate → primary automated verification surface (CI ratchet).
 * Extend this map when new gate-specific suites land; keep commands runnable locally.
 */
const V10_SECTION6_GATE_CI: Record<(typeof V10_ACCEPTANCE_GATES)[number], readonly string[]> = {
  activation: ["npx vitest run src/lib/semantics.test.ts", "npx vitest run src/app/api/import/contracts/route.test.ts"],
  work: ["npx vitest run src/lib/semantics.test.ts", "npm run test:e2e:current-product"],
  contract_record: ["npx vitest run src/lib/semantics.test.ts", "npm run test:e2e:current-product"],
  review_data_quality: ["npx vitest run src/lib/semantics.test.ts"],
  renewal: ["npx vitest run src/lib/semantics.test.ts"],
  evidence: ["npx vitest run src/lib/semantics.test.ts", "npx vitest run src/app/api/cron/v4/evidence-followup/route.test.ts"],
  approval_exception: ["npx vitest run src/lib/semantics.test.ts", "npx vitest run src/lib/operational-contracts.test.ts"],
  search: ["npx vitest run src/lib/route-api-catalog.test.ts", "npx vitest run src/components/layout/command-palette.ui.test.tsx"],
  reporting: ["npx vitest run src/lib/semantics.test.ts", "npx vitest run src/lib/read-model-refresh.test.ts"],
  workspace_governance: ["npx vitest run src/lib/semantics.test.ts", "npx vitest run src/actions/product-surface-settings.test.ts"],
  reliability: ["npx vitest run src/lib/semantics.test.ts", "npx vitest run src/lib/job-visibility.test.ts"],
  security_privacy: ["npx vitest run src/lib/hardening-contracts.test.ts", "npx vitest run src/lib/data-contracts.test.ts"],
  accessibility: ["npx vitest run src/lib/ui-state-contracts.test.ts", "npm run test:e2e:current-product"],
  performance: ["npx vitest run src/lib/route-api-catalog.test.ts", "npx vitest run src/lib/performance-budget-contract.test.ts"],
  data_contract: ["npx vitest run src/lib/data-contracts.test.ts", "npx vitest run src/lib/read-model-refresh.test.ts"],
  objective_measurement: ["npx vitest run src/lib/release-evidence.test.ts", "npm run check:release-evidence"],
};

describe("V10 §6 gate CI matrix", () => {
  it("defines at least one verification command per acceptance gate", () => {
    for (const gate of V10_ACCEPTANCE_GATES) {
      const cmds = V10_SECTION6_GATE_CI[gate];
      expect(cmds?.length ?? 0, gate).toBeGreaterThan(0);
    }
  });
});
