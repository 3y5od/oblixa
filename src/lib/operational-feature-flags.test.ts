import { describe, expect, it } from "vitest";
import { FEATURE_FLAG_ENV_ALIASES } from "@/lib/feature-flags";
import {
  OPERATIONAL_FEATURE_FLAG_CONTRACTS,
  OPERATIONAL_KILL_SWITCH_CONTRACTS,
  OPERATIONAL_ROLLOUT_SAFETY_CASES,
  evaluateOperationalRolloutSafety,
} from "@/lib/operational-feature-flags";

const REQUIRED_KILL_SWITCH_IDS = [
  "extraction-disablement",
  "outbound-email-disablement",
  "webhook-dispatch-pause",
  "cron-family-pause",
  "billing-mutation-freeze",
  "import-export-disablement",
  "integration-sync-pause",
] as const;

const REQUIRED_ROLLOUT_CASES = [
  "default-off",
  "default-on",
  "partial-rollout",
  "org-allowlist",
  "workspace-mode",
  "stale-calibration",
] as const;

describe("operational feature flag contracts", () => {
  it("inventories every runtime feature flag with owner, defaults, expiry, cleanup, and tests", () => {
    const sourceKeys = Object.keys(FEATURE_FLAG_ENV_ALIASES).sort();
    const contractKeys = OPERATIONAL_FEATURE_FLAG_CONTRACTS.map((flag) => flag.key).sort();

    expect(contractKeys).toEqual(sourceKeys);
    expect(new Set(contractKeys).size).toBe(contractKeys.length);

    for (const contract of OPERATIONAL_FEATURE_FLAG_CONTRACTS) {
      expect(contract.envName).toBe(FEATURE_FLAG_ENV_ALIASES[contract.key].neutral);
      expect(contract.legacyAliases).toEqual([FEATURE_FLAG_ENV_ALIASES[contract.key].legacy]);
      expect(contract.ownerArea).toMatch(/\S/);
      expect(Date.parse(contract.expiresOn)).toBeGreaterThan(Date.parse("2026-05-28"));
      expect(contract.cleanupPlan).toMatch(/\S/);
      expect(contract.removalTicket).toMatch(/^OPH-025-FLAG-/);
      expect(contract.killSwitchBehavior).toMatch(/\S/);
      expect(contract.publicExposure).toBe("private");
      expect(contract.validationCommand).toBe("check:operational-feature-flags-rollout");
      expect(contract.testRefs.length).toBeGreaterThan(0);
      expect(Object.keys(contract.defaultByEnvironment).sort()).toEqual([
        "local",
        "preview",
        "production",
        "test",
      ]);
    }
  });

  it("keeps sensitive flag names private", () => {
    const publicSensitiveFlags = OPERATIONAL_FEATURE_FLAG_CONTRACTS.filter(
      (flag) => flag.publicExposure !== "private" && /auth|billing|token|secret|bypass|skip/i.test(flag.envName)
    );
    expect(publicSensitiveFlags).toEqual([]);
  });
});

describe("operational kill switch contracts", () => {
  it("covers required kill-switch families with fail-closed helpers, UI state, and telemetry", () => {
    const ids = new Set(OPERATIONAL_KILL_SWITCH_CONTRACTS.map((contract) => contract.id));
    for (const id of REQUIRED_KILL_SWITCH_IDS) {
      expect(ids.has(id)).toBe(true);
    }

    for (const contract of OPERATIONAL_KILL_SWITCH_CONTRACTS) {
      expect(contract.envName).toMatch(/^OBLIXA_KILL_/);
      expect(contract.helperName).toMatch(/^isKill/);
      expect(contract.helper()).toBe(false);
      expect(contract.defaultState).toBe("off");
      expect(contract.failClosed).toBe(true);
      expect(contract.publicExposure).toBe("private");
      expect(contract.accessibleUiState).toMatchObject({
        status: "paused",
        reason: "operator_kill_switch",
        subsystem: contract.subsystem,
      });
      expect(contract.telemetry).toMatchObject({
        event: "operational.kill_switch_active",
        subsystem: contract.subsystem,
        redaction: "metadata-only",
      });
      expect(contract.testRefs.length).toBeGreaterThan(0);
    }
  });
});

describe("operational rollout safety", () => {
  const baseInput = {
    authenticated: true,
    tenantScoped: true,
    billingAllowed: true,
    workspaceModeAllowed: true,
  };

  it("covers the required rollout cases", () => {
    const ids = new Set(OPERATIONAL_ROLLOUT_SAFETY_CASES.map((contract) => contract.id));
    for (const id of REQUIRED_ROLLOUT_CASES) {
      expect(ids.has(id)).toBe(true);
    }

    for (const contract of OPERATIONAL_ROLLOUT_SAFETY_CASES) {
      expect(contract.guardrails).toEqual(["auth", "tenant-scope", "billing-state", "workspace-mode"]);
      expect(contract.validationCommand).toBe("test:operational-feature-flags");
      expect(contract.testRefs.length).toBeGreaterThan(0);
    }
  });

  it("blocks rollout before case evaluation when auth, tenant, billing, or workspace guardrails fail", () => {
    expect(evaluateOperationalRolloutSafety({ ...baseInput, caseId: "default-on", authenticated: false })).toMatchObject({
      allowed: false,
      blockedGuardrail: "auth",
    });
    expect(evaluateOperationalRolloutSafety({ ...baseInput, caseId: "default-on", tenantScoped: false })).toMatchObject({
      allowed: false,
      blockedGuardrail: "tenant-scope",
    });
    expect(evaluateOperationalRolloutSafety({ ...baseInput, caseId: "default-on", billingAllowed: false })).toMatchObject({
      allowed: false,
      blockedGuardrail: "billing-state",
    });
    expect(
      evaluateOperationalRolloutSafety({ ...baseInput, caseId: "default-on", workspaceModeAllowed: false })
    ).toMatchObject({
      allowed: false,
      blockedGuardrail: "workspace-mode",
    });
  });

  it("handles default-off, default-on, partial, allowlist, workspace, and stale-calibration cases", () => {
    expect(evaluateOperationalRolloutSafety({ ...baseInput, caseId: "default-off" })).toMatchObject({
      allowed: false,
      reason: "default_off",
    });
    expect(evaluateOperationalRolloutSafety({ ...baseInput, caseId: "default-off", explicitlyEnabled: true })).toMatchObject({
      allowed: true,
    });
    expect(evaluateOperationalRolloutSafety({ ...baseInput, caseId: "default-on" })).toMatchObject({ allowed: true });
    expect(
      evaluateOperationalRolloutSafety({
        ...baseInput,
        caseId: "partial-rollout",
        rolloutPercent: 25,
        rolloutBucket: 24,
      })
    ).toMatchObject({ allowed: true });
    expect(
      evaluateOperationalRolloutSafety({
        ...baseInput,
        caseId: "partial-rollout",
        rolloutPercent: 25,
        rolloutBucket: 25,
      })
    ).toMatchObject({ allowed: false, reason: "outside_rollout_bucket" });
    expect(
      evaluateOperationalRolloutSafety({
        ...baseInput,
        caseId: "org-allowlist",
        orgId: "org_1",
        orgAllowlist: ["org_1"],
      })
    ).toMatchObject({ allowed: true });
    expect(evaluateOperationalRolloutSafety({ ...baseInput, caseId: "workspace-mode" })).toMatchObject({
      allowed: true,
    });
    expect(
      evaluateOperationalRolloutSafety({
        ...baseInput,
        caseId: "stale-calibration",
        staleCalibration: true,
      })
    ).toMatchObject({
      allowed: false,
      blockedGuardrail: "stale-calibration",
    });
  });

  it("lets kill switches override otherwise eligible rollout conditions", () => {
    expect(
      evaluateOperationalRolloutSafety({
        ...baseInput,
        caseId: "default-on",
        killSwitchActive: true,
      })
    ).toMatchObject({
      allowed: false,
      reason: "kill_switch_active",
      blockedGuardrail: "kill-switch",
    });
  });
});
