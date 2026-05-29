import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OrganizationSettingsCompatibilityViewRow } from "@/lib/assurance/org-settings";

describe("org settings compatibility aliases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("getOrgSettingsJson returns {} on error or missing row", async () => {
    const maybeSingleErr = vi.fn(async () => ({ data: null, error: { message: "db" } }));
    const adminErr = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: maybeSingleErr }),
        }),
      }),
    };
    const { getOrgSettingsJson } = await import("@/lib/assurance/org-settings");
    expect(await getOrgSettingsJson(adminErr as never, "org-1")).toEqual({});

    const maybeSingleNull = vi.fn(async () => ({ data: null, error: null }));
    const adminNull = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: maybeSingleNull }),
        }),
      }),
    };
    expect(await getOrgSettingsJson(adminNull as never, "org-1")).toEqual({});
  });

  it("getOrgSettingsJson returns {} when json is not an object", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { v6_org_settings_json: "nope" },
      error: null,
    }));
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    };
    const { getOrgSettingsJson } = await import("@/lib/assurance/org-settings");
    expect(await getOrgSettingsJson(admin as never, "org-1")).toEqual({});
  });

  it("readOrgSettingsJsonFromRow prefers the neutral alias and falls back to the legacy column", async () => {
    const { readOrgSettingsJsonFromRow } = await import("@/lib/assurance/org-settings");

    expect(
      readOrgSettingsJsonFromRow({
        org_settings_json: { workspace_mode: "assurance" },
        v6_org_settings_json: { workspace_mode: "core" },
      })
    ).toEqual({ workspace_mode: "assurance" });

    expect(
      readOrgSettingsJsonFromRow({
        v6_org_settings_json: { workspace_mode: "advanced" },
      })
    ).toEqual({ workspace_mode: "advanced" });
  });

  it("readOrgSettingsJsonFromRow accepts the neutral organization settings view row shape", async () => {
    const { readOrgSettingsJsonFromRow } = await import("@/lib/assurance/org-settings");
    const row = {
      organization_id: "org-1",
      organization_name: "Acme",
      org_settings_json: {
        workspace_mode: "assurance",
        autopilot_allow_execution: true,
      },
    } satisfies OrganizationSettingsCompatibilityViewRow;

    expect(readOrgSettingsJsonFromRow(row)).toEqual({
      workspace_mode: "assurance",
      autopilot_allow_execution: true,
    });
  });

  it("getOrgSettingsJson normalizes stale module and role keys on read", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        v6_org_settings_json: {
          workspace_mode: "assurance",
          advanced_modules_hidden: ["decisions", "not_real"],
          assurance_modules_hidden: ["autopilot", "not_real"],
          utility_modules_hidden: ["intake", "not_real"],
          advanced_nav_roles: ["admin", "not_real"],
          assurance_nav_roles: ["manager", "not_real"],
          search_scope: "invalid",
          default_landing_path: "/dashboard",
        },
      },
      error: null,
    }));
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    };
    const { getOrgSettingsJson } = await import("@/lib/assurance/org-settings");
    expect(await getOrgSettingsJson(admin as never, "org-1")).toEqual(
      expect.objectContaining({
        workspace_mode: "assurance",
        advanced_modules_hidden: ["decisions"],
        assurance_modules_hidden: ["autopilot"],
        utility_modules_hidden: ["intake"],
        advanced_nav_roles: ["admin"],
        assurance_nav_roles: ["manager"],
        search_scope: "match_mode",
        default_landing_path: "/dashboard",
      })
    );
  });

  it("normalizes operational org status for authz fail-closed checks", async () => {
    const { readOrgSettingsJsonFromRow } = await import("@/lib/assurance/org-settings");

    expect(
      readOrgSettingsJsonFromRow({
        v6_org_settings_json: { operational_status: "suspended" },
      })
    ).toEqual({ operational_status: "suspended" });
    expect(
      readOrgSettingsJsonFromRow({
        v6_org_settings_json: { operational_status: "invalid" },
      })
    ).toEqual({});
  });

  it("mergeOrgSettingsJson filters unknown advanced_modules_hidden keys", async () => {
    const read = vi.fn(async () => ({
      data: { v6_org_settings_json: {} },
      error: null,
    }));
    let updatedPayload: unknown;
    const write = vi.fn(async () => ({
      data: { v6_org_settings_json: updatedPayload },
      error: null,
    }));
    const admin = {
      from: (table: string) => {
        if (table !== "organizations") throw new Error(table);
        return {
          select: () => ({
            eq: () => ({ maybeSingle: read }),
          }),
          update: (payload: { v6_org_settings_json: unknown }) => {
            updatedPayload = payload.v6_org_settings_json;
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: write,
                }),
              }),
            };
          },
        };
      },
    };
    const { mergeOrgSettingsJson } = await import("@/lib/assurance/org-settings");
    const { data, error } = await mergeOrgSettingsJson(admin as never, "org-1", {
      advanced_modules_hidden: ["decisions", "not_a_real_module" as never],
    });
    expect(error).toBeNull();
    expect(data?.advanced_modules_hidden).toEqual(["decisions"]);
  });

  it("isOrgAutopilotExecutionAllowed requires assurance mode and explicit flag", async () => {
    const { isOrgAutopilotExecutionAllowed } = await import("@/lib/assurance/org-settings");
    let settings: Record<string, unknown> = {};
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { v6_org_settings_json: settings }, error: null }),
          }),
        }),
      }),
    };
    expect(await isOrgAutopilotExecutionAllowed(admin as never, "o1")).toBe(false);
    settings = { workspace_mode: "core", autopilot_allow_execution: true };
    expect(await isOrgAutopilotExecutionAllowed(admin as never, "o1")).toBe(false);
    settings = { workspace_mode: "assurance", autopilot_allow_execution: false };
    expect(await isOrgAutopilotExecutionAllowed(admin as never, "o1")).toBe(false);
    settings = { workspace_mode: "assurance", autopilot_allow_execution: true };
    expect(await isOrgAutopilotExecutionAllowed(admin as never, "o1")).toBe(true);
  });
});
