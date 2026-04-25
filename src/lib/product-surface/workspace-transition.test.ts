import { describe, expect, it } from "vitest";
import {
  reportSubscriptionIdsIneligibleForWorkspaceMode,
  suppressNotificationTypesForModeDowngrade,
} from "@/lib/product-surface/workspace-transition";

describe("workspace product transition side effects", () => {
  it("computes report subscriptions to suppress without deleting saved objects", () => {
    const subscriptions = [
      { id: "sub-core", report_pack_id: "pack-core" },
      { id: "sub-advanced", report_pack_id: "pack-advanced" },
      { id: "sub-assurance", report_pack_id: "pack-assurance" },
    ];
    const packs = [
      { id: "pack-core", report_type: "monthly_renewal_readiness" },
      { id: "pack-advanced", report_type: "decision_queue_summary" },
      { id: "pack-assurance", report_type: "scorecard_summary" },
    ];

    expect(
      reportSubscriptionIdsIneligibleForWorkspaceMode({
        mode: "core",
        subscriptions,
        packs,
      })
    ).toEqual(["sub-advanced", "sub-assurance"]);
    expect(
      reportSubscriptionIdsIneligibleForWorkspaceMode({
        mode: "advanced",
        subscriptions,
        packs,
      })
    ).toEqual(["sub-assurance"]);
  });

  it("keeps notification downgrade upsert org-scoped and non-destructive", async () => {
    const writes: unknown[] = [];
    const admin = {
      from(table: string) {
        if (table !== "organization_workflow_settings") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select() {
            return {
              eq(column: string, orgId: string) {
                expect(column).toBe("organization_id");
                expect(orgId).toBe("org_1");
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        notification_policy_json: {
                          email: { blocked_types: ["existing_type"] },
                          slack: { blocked_types: [] },
                        },
                        weekly_intake_lookback_days: 7,
                        renewal_horizon_days: 90,
                        stale_contract_days: 120,
                        stale_ownership_days: 90,
                      },
                    };
                  },
                };
              },
            };
          },
          async upsert(payload: unknown, options: unknown) {
            writes.push({ payload, options });
            return { error: null };
          },
        };
      },
    };

    const blocked = await suppressNotificationTypesForModeDowngrade({
      admin: admin as never,
      orgId: "org_1",
      mode: "core",
    });

    expect(blocked.length).toBeGreaterThan(0);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      payload: {
        organization_id: "org_1",
        notification_policy_json: {
          email: { blocked_types: expect.arrayContaining(["existing_type"]) },
          slack: { blocked_types: expect.any(Array) },
        },
      },
      options: { onConflict: "organization_id", ignoreDuplicates: false },
    });
  });
});

