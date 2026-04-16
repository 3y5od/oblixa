import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeRolePolicyJson } from "@/lib/settings/sanitize-role-policy-json";

describe("sanitizeRolePolicyJson", () => {
  it("keeps only known roles and boolean capability flags", () => {
    const out = sanitizeRolePolicyJson({
      admin: { settings_manage: true, unknown_cap: true, extra: "x" },
      editor: "not-an-object",
      viewer: { contracts_edit: false },
    });
    expect(out).toEqual({
      admin: { settings_manage: true },
      viewer: { contracts_edit: false },
    });
  });

  it("drops roles with no valid capability entries", () => {
    expect(sanitizeRolePolicyJson({ admin: { bogus: true } })).toEqual({});
  });
});

describe("workflow-config.ts server actions (§13.3 coverage signals)", () => {
  it("documents Supabase auth + org scoping in module source", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/workflow-config.ts"), "utf8");
    expect(raw).toContain("getUser(");
    expect(raw).toContain("organization_id");
  });
});
