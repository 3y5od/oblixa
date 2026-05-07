import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();
const mergeV6OrgSettingsJson = vi.fn();
const getV6OrgSettingsJson = vi.fn();
const requireServerActionEligibility = vi.fn();
const applyWorkspaceProductTransitionSideEffects = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();

function makeV10Rpc() {
  return vi.fn((fn: string, args: Record<string, unknown>) => {
    if (fn === "claim_v10_mutation_idempotency") {
      return Promise.resolve({
        data: [
          {
            claim_result: "claimed",
            request_hash: args.p_request_hash,
            response_json: args.p_pending_response_json,
            claim_status: "in_progress",
          },
        ],
        error: null,
      });
    }
    if (fn === "complete_v10_mutation_idempotency") {
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } });
  });
}

function makeAdmin(from: ReturnType<typeof vi.fn>) {
  return { from, rpc: makeV10Rpc() };
}

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext: (...args: unknown[]) => getAuthContext(...args),
}));

vi.mock("@/lib/v6/org-settings", () => ({
  mergeV6OrgSettingsJson: (...args: unknown[]) => mergeV6OrgSettingsJson(...args),
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/product-surface/server-action-guard", () => ({
  requireServerActionEligibility: (...args: unknown[]) => requireServerActionEligibility(...args),
}));

vi.mock("@/lib/product-surface/workspace-transition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-surface/workspace-transition")>();
  return {
    ...actual,
    applyWorkspaceProductTransitionSideEffects: (...args: unknown[]) =>
      applyWorkspaceProductTransitionSideEffects(...args),
  };
});

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization: (...args: unknown[]) => refreshV10ReadModelsForOrganization(...args),
}));

vi.mock("@/lib/product-surface/landing-eligibility", () => ({
  isValidDefaultLandingPath: (path: string, mode: string) =>
    !(mode === "core" && ["/decisions", "/campaigns"].includes(path)),
}));

describe("updateWorkspaceProductSurfaceForm (refinement §19 / §21)", () => {
  beforeEach(() => {
    getAuthContext.mockReset();
    mergeV6OrgSettingsJson.mockReset();
    getV6OrgSettingsJson.mockReset();
    requireServerActionEligibility.mockReset();
    applyWorkspaceProductTransitionSideEffects.mockReset();
    refreshV10ReadModelsForOrganization.mockReset();
    getV6OrgSettingsJson.mockResolvedValue({});
    mergeV6OrgSettingsJson.mockResolvedValue({ error: null });
    requireServerActionEligibility.mockResolvedValue({ ok: true });
    applyWorkspaceProductTransitionSideEffects.mockResolvedValue({
      autoBlockedNotificationTypes: [],
      suppressedSubscriptionCount: 0,
    });
  });

  it("returns error when unauthenticated", async () => {
    getAuthContext.mockResolvedValue(null);
    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "advanced");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ error: "Only workspace admins can change product experience settings." });
    expect(mergeV6OrgSettingsJson).not.toHaveBeenCalled();
  });

  it("returns error when caller is not admin", async () => {
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "org-1",
      role: "editor",
      user: { id: "u1" },
    });
    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "assurance");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ error: "Only workspace admins can change product experience settings." });
    expect(mergeV6OrgSettingsJson).not.toHaveBeenCalled();
  });

  it("rejects default_landing_path when invalid for selected workspace mode", async () => {
    getAuthContext.mockResolvedValue({
      admin: { from: vi.fn() },
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });
    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "core");
    fd.set("default_landing_path", "/decisions");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ error: "That default landing path is not available in the selected workspace mode." });
    expect(mergeV6OrgSettingsJson).not.toHaveBeenCalled();
  });

  it("allows workspace mode changes even when stored billing metadata is lower tier", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core", workspace_plan: "core" });
    mergeV6OrgSettingsJson.mockResolvedValue({ data: { workspace_mode: "assurance" }, error: null });
    const from = vi.fn((table: string) => {
      if (table === "v10_audit_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { audit_event_id: "v10-audit-1" }, error: null })),
            })),
          })),
        };
      }
      return {
        insert: vi.fn(async () => ({ error: null })),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      };
    });
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });
    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "assurance");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ success: true });
    expect(mergeV6OrgSettingsJson).toHaveBeenCalledWith(
      expect.objectContaining({ from }),
      "org-1",
      expect.objectContaining({ workspace_mode: "assurance" })
    );
  });

  it("requires confirmation before downgrade suppresses scheduled report subscriptions", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "advanced", workspace_plan: "advanced" });
    const from = vi.fn((table: string) => {
      if (table === "report_pack_subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [{ id: "sub-1", report_pack_id: "pack-1" }], error: null })),
            })),
          })),
        };
      }
      if (table === "report_packs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ id: "pack-1", report_type: "decision_queue_summary" }],
                error: null,
              })),
            })),
          })),
        };
      }
      return {
        insert: vi.fn(async () => ({ error: null })),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      };
    });
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });

    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "core");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({
      error: "This mode change would suppress 1 active scheduled report subscription. Confirm scheduled report suppression and save again.",
    });
    expect(mergeV6OrgSettingsJson).not.toHaveBeenCalled();
  });

  it("merges settings scoped to authenticated org for admin", async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "v10_audit_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { audit_event_id: "v10-audit-1" }, error: null })),
            })),
          })),
        };
      }
      return {
        insert,
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })),
          in: vi.fn(async () => ({ data: [] })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
          in: vi.fn(async () => ({ error: null })),
        })),
      };
    });
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });
    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "core");
    fd.set("default_landing_path", "/dashboard");
    fd.set("hide_assurance_autopilot", "on");
    fd.set("search_scope", "core_only");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ success: true });
    expect(mergeV6OrgSettingsJson).toHaveBeenCalledWith(
      expect.objectContaining({ from }),
      "org-1",
      expect.objectContaining({
        workspace_mode: "core",
        assurance_modules_hidden: ["autopilot"],
        search_scope: "core_only",
      })
    );
    expect(from).toHaveBeenCalledWith("audit_events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workspace.product_surface_updated",
        details: expect.objectContaining({
          prev_advanced_nav_roles: null,
          next_advanced_nav_roles: null,
          prev_assurance_nav_roles: null,
          next_assurance_nav_roles: null,
          prev_home_hidden_sections: [],
          next_home_hidden_sections: [],
          prev_autopilot_allow_execution: false,
          next_autopilot_allow_execution: false,
          auto_blocked_notification_types: [],
          suppressed_report_pack_subscription_count: 0,
        }),
      })
    );
  });

  it("still succeeds when legacy workspace audit insert throws after settings are saved", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const from = vi.fn((table: string) => ({
      insert: vi.fn(async () => {
        if (table === "audit_events") throw new Error("audit insert unavailable");
        return { error: null };
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null })),
        })),
        in: vi.fn(async () => ({ data: [] })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
        in: vi.fn(async () => ({ error: null })),
      })),
    }));
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });
    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "core");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ success: true });
    expect(mergeV6OrgSettingsJson).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("still saves settings when V10 mutation reservation cannot be claimed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const from = vi.fn((table: string) => {
      if (table === "v10_audit_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { audit_event_id: "v10-audit-1" }, error: null })),
            })),
          })),
        };
      }
      return {
        insert: vi.fn(async () => ({ error: null })),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      };
    });
    getAuthContext.mockResolvedValue({
      admin: {
        from,
        rpc: vi.fn(async () => {
          throw new Error("network timeout");
        }),
      },
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });
    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "core");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ success: true });
    expect(mergeV6OrgSettingsJson).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("resetWorkspaceProductSurfaceDefaultsForm resets to conservative core defaults", async () => {
    const from = vi.fn((table: string) => {
      if (table === "v10_audit_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { audit_event_id: "v10-reset-audit" }, error: null })),
            })),
          })),
        };
      }
      return {
        insert: vi.fn(() => Promise.resolve({ error: null })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })),
          in: vi.fn(async () => ({ data: [] })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
          in: vi.fn(async () => ({ error: null })),
        })),
      };
    });
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });
    const { resetWorkspaceProductSurfaceDefaultsForm } = await import(
      "@/actions/product-surface-settings"
    );
    const result = await resetWorkspaceProductSurfaceDefaultsForm();
    expect(result).toEqual({ success: true });
    expect(mergeV6OrgSettingsJson).toHaveBeenCalledWith(
      expect.objectContaining({ from }),
      "org-1",
      expect.objectContaining({
        workspace_mode: "core",
        search_scope: "match_mode",
      })
    );
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ from }),
      "org-1",
      expect.objectContaining({
        refreshScope: "one_model",
        reason: "product_surface_settings_mutation",
        modelKeys: expect.arrayContaining(["notification_deliveries", "audit_events", "command_search_index"]),
      })
    );
  });

  it("captures downgrade side-effect details for blocked notification types and suppressed subscriptions", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "advanced" });
    mergeV6OrgSettingsJson.mockResolvedValue({
      data: { workspace_mode: "core" },
      error: null,
    });
    applyWorkspaceProductTransitionSideEffects.mockResolvedValueOnce({
      autoBlockedNotificationTypes: ["campaign_digest"],
      suppressedSubscriptionCount: 1,
    });

    const inserts: Array<Record<string, unknown>> = [];
    const from = vi.fn((table: string) => {
      if (table === "audit_events") {
        return {
          insert: vi.fn(async (row: Record<string, unknown>) => {
            inserts.push(row);
            return { error: null };
          }),
        };
      }
      if (table === "v10_audit_events") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            inserts.push({ ...row, action: row.action ?? "v10.audit" });
            return {
              select: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { audit_event_id: "v10-audit-1" }, error: null })),
              })),
            };
          }),
        };
      }
      if (table === "report_pack_subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
          update: vi.fn(() => ({ in: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
        };
      }
      if (table === "report_packs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        insert: vi.fn(async () => ({ error: null })),
        upsert: vi.fn(async () => ({ error: null })),
      };
    });

    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });

    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "core");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ success: true });
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ from }),
      "org-1",
      expect.objectContaining({
        refreshScope: "one_model",
        reason: "product_surface_settings_mutation",
      })
    );

    const surfaceAudit = inserts.find((row) => row.action === "workspace.product_surface_updated") as
      | { details?: Record<string, unknown> }
      | undefined;
    expect(surfaceAudit?.details?.auto_blocked_notification_types).toEqual(
      expect.arrayContaining(["campaign_digest"])
    );
    expect(surfaceAudit?.details?.suppressed_report_pack_subscription_count).toBe(1);
  });

  it("allows confirmed downgrade when scheduled report subscriptions will be suppressed", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "advanced", workspace_plan: "advanced" });
    mergeV6OrgSettingsJson.mockResolvedValue({
      data: { workspace_mode: "core" },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "report_pack_subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [{ id: "sub-1", report_pack_id: "pack-1" }], error: null })),
            })),
          })),
          update: vi.fn(() => ({
            in: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          })),
        };
      }
      if (table === "report_packs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ id: "pack-1", report_type: "decision_queue_summary" }],
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "v10_audit_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { audit_event_id: "v10-audit-1" }, error: null })),
            })),
          })),
        };
      }
      return {
        insert: vi.fn(async () => ({ error: null })),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      };
    });
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });

    const { updateWorkspaceProductSurfaceForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("workspace_mode", "core");
    fd.set("confirm_scheduled_report_downgrade", "on");
    const result = await updateWorkspaceProductSurfaceForm(fd);
    expect(result).toEqual({ success: true });
    expect(mergeV6OrgSettingsJson).toHaveBeenCalled();
  });
});

describe("updateProductEmailNotificationCategoriesForm (refinement §18 / §21)", () => {
  beforeEach(() => {
    getAuthContext.mockReset();
    requireServerActionEligibility.mockReset();
    refreshV10ReadModelsForOrganization.mockReset();
    requireServerActionEligibility.mockResolvedValue({ ok: true });
  });

  it("returns error when caller is not admin", async () => {
    const from = vi.fn();
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "editor",
      user: { id: "u1" },
    });
    const { updateProductEmailNotificationCategoriesForm } = await import("@/actions/product-surface-settings");
    const result = await updateProductEmailNotificationCategoriesForm(new FormData());
    expect(result).toEqual({ error: "Unauthorized" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns error when unauthenticated", async () => {
    getAuthContext.mockResolvedValue(null);
    const { updateProductEmailNotificationCategoriesForm } = await import("@/actions/product-surface-settings");
    const result = await updateProductEmailNotificationCategoriesForm(new FormData());
    expect(result).toEqual({ error: "Unauthorized" });
    expect(getAuthContext).toHaveBeenCalled();
  });

  it("updates organization_workflow_settings.notification_policy_json for admin org only", async () => {
    const eqLog: { col: string; val: string }[] = [];
    const updatePayloads: Array<Record<string, unknown>> = [];
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "v10_audit_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { audit_event_id: "v10-notification-audit" }, error: null })),
            })),
          })),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({
              data: { notification_policy_json: { email: { blocked_types: ["legacy_unknown_type"] } } },
              error: null,
            })),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return {
          eq: (col: string, val: string) => {
            eqLog.push({ col, val });
            return Promise.resolve({ error: null });
          },
          };
        },
        insert,
      };
    });
    getAuthContext.mockResolvedValue({
      admin: makeAdmin(from),
      orgId: "org-1",
      role: "admin",
      user: { id: "u1" },
    });
    const { updateProductEmailNotificationCategoriesForm } = await import("@/actions/product-surface-settings");
    const fd = new FormData();
    fd.set("mute_email_campaign_digest", "on");
    const result = await updateProductEmailNotificationCategoriesForm(fd);
    expect(result).toEqual({ success: true });
    expect(from).toHaveBeenCalled();
    expect(eqLog[0]).toEqual({ col: "organization_id", val: "org-1" });
    expect(updatePayloads[0]?.notification_policy_json).toMatchObject({
      email: { blocked_types: ["campaign_digest"] },
    });
    expect(from).toHaveBeenCalledWith("audit_events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workspace.notification_policy_updated",
        details: expect.objectContaining({
          channel: "email",
          affected_known_categories: ["campaign_digest"],
        }),
      })
    );
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ from }),
      "org-1",
      expect.objectContaining({
        refreshScope: "one_model",
        reason: "product_surface_settings_mutation",
      })
    );
  });
});
