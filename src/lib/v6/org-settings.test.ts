import { describe, expect, it, vi, beforeEach } from "vitest";

describe("v6 org-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("getV6OrgSettingsJson returns {} on error or missing row", async () => {
    const maybeSingleErr = vi.fn(async () => ({ data: null, error: { message: "db" } }));
    const adminErr = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: maybeSingleErr }),
        }),
      }),
    };
    const { getV6OrgSettingsJson } = await import("@/lib/v6/org-settings");
    expect(await getV6OrgSettingsJson(adminErr as never, "org-1")).toEqual({});

    const maybeSingleNull = vi.fn(async () => ({ data: null, error: null }));
    const adminNull = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: maybeSingleNull }),
        }),
      }),
    };
    expect(await getV6OrgSettingsJson(adminNull as never, "org-1")).toEqual({});
  });

  it("getV6OrgSettingsJson returns {} when json is not an object", async () => {
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
    const { getV6OrgSettingsJson } = await import("@/lib/v6/org-settings");
    expect(await getV6OrgSettingsJson(admin as never, "org-1")).toEqual({});
  });

  it("getV6OrgSettingsJson normalizes stale module and role keys on read", async () => {
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
    const { getV6OrgSettingsJson } = await import("@/lib/v6/org-settings");
    expect(await getV6OrgSettingsJson(admin as never, "org-1")).toEqual(
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

  it("mergeV6OrgSettingsJson filters unknown advanced_modules_hidden keys", async () => {
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
    const { mergeV6OrgSettingsJson } = await import("@/lib/v6/org-settings");
    const { data, error } = await mergeV6OrgSettingsJson(admin as never, "org-1", {
      advanced_modules_hidden: ["decisions", "not_a_real_module" as never],
    });
    expect(error).toBeNull();
    expect(data?.advanced_modules_hidden).toEqual(["decisions"]);
  });

  it("isOrgAutopilotExecutionAllowed requires assurance mode and explicit flag", async () => {
    const { isOrgAutopilotExecutionAllowed } = await import("@/lib/v6/org-settings");
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
