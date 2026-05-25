import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled, type FeatureFlagKey } from "@/lib/feature-flags";
import { requireV5ApiFeature, requireV5CronFeature } from "@/lib/decision-intelligence/feature-guards";

/** Every `ENABLE_V5_*` env paired with its parsed key (see `src/lib/feature-flags.ts`). */
const V5_FLAG_ENV: { env: string; key: FeatureFlagKey }[] = [
  { env: "ENABLE_V5_DECISION_FOUNDATION", key: "v5DecisionFoundation" },
  { env: "ENABLE_V5_PORTFOLIO_CAMPAIGNS", key: "v5PortfolioCampaigns" },
  { env: "ENABLE_V5_SIMULATION_AND_INTELLIGENCE", key: "v5SimulationAndIntelligence" },
  { env: "ENABLE_V5_RELATIONSHIP_LAYER", key: "v5RelationshipLayer" },
  { env: "ENABLE_V5_EXTERNAL_COLLABORATION", key: "v5ExternalCollaboration" },
  { env: "ENABLE_V5_CONTROL_ROOM_UX", key: "v5ControlRoomUx" },
];

function stubAllV5Enabled() {
  for (const { env } of V5_FLAG_ENV) {
    vi.stubEnv(env, "true");
  }
}

/**
 * Mirrors cron `requireV5CronFeature` usage in `src/app/api/cron/v5/*`.
 * One entry per distinct flag checked by a v5 cron handler.
 */
const CRON_FLAG_KEYS: FeatureFlagKey[] = [
  "v5PortfolioCampaigns",
  "v5SimulationAndIntelligence",
  "v5ExternalCollaboration",
  "v5DecisionFoundation",
  "v5RelationshipLayer",
];

describe("V5 flag matrix (staging-style: one flag off, rest on)", () => {
  beforeEach(() => {
    vi.resetModules();
    stubAllV5Enabled();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  for (const { env, key } of V5_FLAG_ENV) {
    it(`disables ${key} when ${env}=false and others stay on`, () => {
      stubAllV5Enabled();
      vi.stubEnv(env, "false");
      expect(isFeatureEnabled(key)).toBe(false);
      for (const other of V5_FLAG_ENV) {
        if (other.key === key) continue;
        expect(isFeatureEnabled(other.key)).toBe(true);
      }
    });
  }

  for (const key of V5_FLAG_ENV.map((x) => x.key)) {
    if (key === "v5ControlRoomUx") continue;
    it(`requireV5ApiFeature(${key}) returns 403 when only that flag is off`, () => {
      stubAllV5Enabled();
      const entry = V5_FLAG_ENV.find((x) => x.key === key)!;
      vi.stubEnv(entry.env, "false");
      const res = requireV5ApiFeature(key);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });
  }

  for (const key of CRON_FLAG_KEYS) {
    it(`requireV5CronFeature(${key}) skips when only that flag is off`, async () => {
      stubAllV5Enabled();
      const entry = V5_FLAG_ENV.find((x) => x.key === key)!;
      vi.stubEnv(entry.env, "false");
      const res = requireV5CronFeature(key);
      expect(res).not.toBeNull();
      const body = await res!.json();
      expect(body).toMatchObject({ ok: true, skipped: true, reason: "feature_disabled" });
    });
  }
});
