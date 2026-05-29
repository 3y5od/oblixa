import { describe, expect, it } from "vitest";
import {
  applyRequiredOrgScope,
  assertPayloadOrgScope,
  createOrgScopedAdminContext,
  getExplicitOrgIdFromInput,
  getExplicitOrgIdFromRequest,
  getExplicitOrgIdFromRequestWithBody,
  orgOperationalStatusFromRow,
  orgResolutionHttpStatus,
  requireServiceRoleOrgId,
  resolveExplicitOrSingleMembership,
  resolveSensitiveOrgContext,
  updateWithRequiredOrgScope,
  withRequiredOrgId,
} from "@/lib/supabase/org-scoped-admin";

describe("service-role org-scoped admin helpers", () => {
  it("requires a non-empty org id", () => {
    expect(() => requireServiceRoleOrgId("")).toThrow("service_role_org_id_required");
    expect(() => requireServiceRoleOrgId("   ")).toThrow("service_role_org_id_required");
    expect(requireServiceRoleOrgId(" org_123 ")).toBe("org_123");
  });

  it("applies required organization_id predicates to admin queries", () => {
    const calls: Array<[string, string]> = [];
    const query = {
      eq(column: string, value: string) {
        calls.push([column, value]);
        return this;
      },
    };
    expect(applyRequiredOrgScope(query, " org_1 ")).toBe(query);
    expect(calls).toEqual([["organization_id", "org_1"]]);
  });

  it("adds required organization_id to mutation payloads", () => {
    expect(withRequiredOrgId({ name: "A" }, "org_1")).toEqual({
      name: "A",
      organization_id: "org_1",
    });
    expect(withRequiredOrgId([{ id: "1" }, { id: "2", organization_id: "wrong" }], "org_1")).toEqual([
      { id: "1", organization_id: "org_1" },
      { id: "2", organization_id: "org_1" },
    ]);
  });

  it("rejects mutation payloads without matching org scope", () => {
    expect(() => assertPayloadOrgScope({ organization_id: "org_1" }, "org_1")).not.toThrow();
    expect(() => assertPayloadOrgScope({ organization_id: "org_2" }, "org_1")).toThrow(
      "service_role_payload_org_scope_required"
    );
    expect(() => assertPayloadOrgScope([{ organization_id: "org_1" }, { name: "missing" }], "org_1")).toThrow(
      "service_role_payload_org_scope_required"
    );
  });

  it("binds update payloads and predicates to the same required org scope", () => {
    const updates: unknown[] = [];
    const predicates: Array<[string, string]> = [];
    const scopedQuery = {
      eq(column: string, value: string) {
        predicates.push([column, value]);
        return this;
      },
    };
    const rootQuery = {
      update(payload: unknown) {
        updates.push(payload);
        return scopedQuery;
      },
    };

    expect(updateWithRequiredOrgScope(rootQuery, { name: "Updated", organization_id: "wrong" }, "org_1")).toBe(scopedQuery);
    expect(updates).toEqual([{ name: "Updated", organization_id: "org_1" }]);
    expect(predicates).toEqual([["organization_id", "org_1"]]);
  });

  it("extracts explicit org scope only from trusted request locations", () => {
    expect(
      getExplicitOrgIdFromRequest(
        new Request("https://app.test/api/export?organizationId=org_query", {
          headers: { "x-oblixa-organization-id": " org_header " },
        })
      )
    ).toBe("org_header");
    expect(getExplicitOrgIdFromRequest(new Request("https://app.test/api/export?orgId=org_query"))).toBe("org_query");
    expect(getExplicitOrgIdFromRequest(new Request("https://app.test/api/export"))).toBeNull();
  });

  it("extracts explicit org scope from action inputs and cloned request bodies before headers", async () => {
    expect(getExplicitOrgIdFromInput({ organizationId: " org_input " })).toBe("org_input");
    expect(getExplicitOrgIdFromInput({ orgId: "org_short" })).toBe("org_short");
    expect(getExplicitOrgIdFromInput({ organization_id: "org_snake" })).toBe("org_snake");
    expect(getExplicitOrgIdFromInput({ organizationId: " " })).toBeNull();

    const request = new Request("https://app.test/api/export?orgId=org_query", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-oblixa-organization-id": "org_header",
      },
      body: JSON.stringify({ organizationId: "org_body" }),
    });
    await expect(getExplicitOrgIdFromRequestWithBody(request)).resolves.toBe("org_body");
    await expect(request.json()).resolves.toEqual({ organizationId: "org_body" });
  });

  it("resolves explicit org membership and rejects cross-org requests", async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: (column: string, value: string) => {
            expect([column, value]).toEqual(["user_id", "user_1"]);
            return {
              eq: (orgColumn: string, orgValue: string) => ({
                maybeSingle: async () => ({
                  data:
                    orgColumn === "organization_id" && orgValue === "org_1"
                      ? { organization_id: "org_1", role: "admin" }
                      : null,
                  error: null,
                }),
              }),
            };
          },
        }),
      }),
    };

    await expect(resolveExplicitOrSingleMembership(admin, "user_1", "org_1")).resolves.toEqual({
      ok: true,
      membership: { organization_id: "org_1", role: "admin" },
    });
    await expect(resolveExplicitOrSingleMembership(admin, "user_1", "org_2")).resolves.toEqual({
      ok: false,
      reason: "organization_membership_missing",
    });
  });

  it("does not fall back from a stale selected org to an implicit membership", async () => {
    let implicitFallbackQueried = false;
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
            order: () => {
              implicitFallbackQueried = true;
              return {
                limit: async () => ({
                  data: [{ organization_id: "org_current", role: "admin" }],
                  error: null,
                }),
              };
            },
          }),
        }),
      }),
    };

    await expect(resolveExplicitOrSingleMembership(admin, "user_1", "org_stale")).resolves.toEqual({
      ok: false,
      reason: "organization_membership_missing",
    });
    expect(implicitFallbackQueried).toBe(false);
  });

  it("fails closed for missing actor and membership query errors", async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: null, error: { message: "db unavailable" } }),
            }),
          }),
        }),
      }),
    };

    await expect(resolveExplicitOrSingleMembership(admin, "   ")).resolves.toEqual({
      ok: false,
      reason: "organization_membership_missing",
    });
    await expect(resolveExplicitOrSingleMembership(admin, "user_1")).resolves.toEqual({
      ok: false,
      reason: "organization_membership_query_failed",
      detail: "db unavailable",
    });
  });

  it("allows implicit org fallback only for exactly one membership", async () => {
    function adminWithRows(rows: unknown[]) {
      return {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async (count: number) => {
                  expect(count).toBe(2);
                  return { data: rows, error: null };
                },
              }),
            }),
          }),
        }),
      };
    }

    await expect(
      resolveExplicitOrSingleMembership(adminWithRows([{ organization_id: "org_1", role: "editor" }]), "user_1")
    ).resolves.toEqual({
      ok: true,
      membership: { organization_id: "org_1", role: "editor" },
    });
    await expect(
      resolveExplicitOrSingleMembership(
        adminWithRows([
          { organization_id: "org_1", role: "admin" },
          { organization_id: "org_2", role: "viewer" },
        ]),
        "user_1"
      )
    ).resolves.toEqual({ ok: false, reason: "organization_membership_ambiguous" });
  });

  it("returns typed sensitive org context failures with fail-closed statuses", async () => {
    const ambiguousAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  { organization_id: "org_1", role: "admin" },
                  { organization_id: "org_2", role: "viewer" },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    await expect(resolveSensitiveOrgContext(ambiguousAdmin, { id: "user_1" })).resolves.toEqual({
      ok: false,
      reason: "organization_membership_ambiguous",
      status: 409,
      detail: undefined,
    });
    expect(orgResolutionHttpStatus("organization_membership_missing")).toBe(403);
    expect(orgResolutionHttpStatus("organization_membership_query_failed")).toBe(403);
  });

  it("rejects inactive and suspended organizations for sensitive org context", async () => {
    function adminWithOrgStatus(operationalStatus: "active" | "inactive" | "suspended") {
      return {
        from: (table: string) => {
          if (table === "organization_members") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { organization_id: "org_1", role: "admin" },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "org_1", v6_org_settings_json: { operational_status: operationalStatus } },
                  error: null,
                }),
              }),
            }),
          };
        },
      };
    }

    await expect(resolveSensitiveOrgContext(adminWithOrgStatus("active"), { id: "user_1" }, "org_1")).resolves.toEqual({
      ok: true,
      organizationId: "org_1",
      role: "admin",
      membership: { organization_id: "org_1", role: "admin" },
    });
    await expect(resolveSensitiveOrgContext(adminWithOrgStatus("inactive"), { id: "user_1" }, "org_1")).resolves.toEqual({
      ok: false,
      reason: "organization_inactive",
      status: 403,
      detail: undefined,
    });
    await expect(resolveSensitiveOrgContext(adminWithOrgStatus("suspended"), { id: "user_1" }, "org_1")).resolves.toEqual({
      ok: false,
      reason: "organization_suspended",
      status: 403,
      detail: undefined,
    });
  });

  it("normalizes operational org status rows for authz evidence", () => {
    expect(orgOperationalStatusFromRow({ v6_org_settings_json: { operational_status: "inactive" } })).toBe("inactive");
    expect(orgOperationalStatusFromRow({ v6_org_settings_json: { operational_status: "suspended" } })).toBe("suspended");
    expect(orgOperationalStatusFromRow({ v6_org_settings_json: { operational_status: "invalid" } })).toBe("active");
    expect(orgOperationalStatusFromRow(null)).toBeNull();
  });

  it("creates an org-scoped admin context that binds predicates and payloads", () => {
    const predicates: Array<[string, string]> = [];
    const admin = {
      from: (table: string) => ({ table }),
    };
    const context = createOrgScopedAdminContext(admin, "org_1");
    const query = {
      eq(column: string, value: string) {
        predicates.push([column, value]);
        return this;
      },
    };

    expect(context.organizationId).toBe("org_1");
    expect(context.from("contracts")).toEqual({ table: "contracts" });
    expect(context.scope(query)).toBe(query);
    expect(context.bindPayload({ title: "Contract" })).toEqual({
      title: "Contract",
      organization_id: "org_1",
    });
    expect(() => context.assertPayload({ organization_id: "org_2" })).toThrow(
      "service_role_payload_org_scope_required"
    );
    expect(predicates).toEqual([["organization_id", "org_1"]]);
  });
});
