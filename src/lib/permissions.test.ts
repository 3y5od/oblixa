import { describe, expect, it } from "vitest";
import { canDeleteContracts, canEditContracts } from "@/lib/permissions";

describe("canEditContracts", () => {
  it("allows admin, editor, ops_manager, manager", () => {
    expect(canEditContracts("admin")).toBe(true);
    expect(canEditContracts("editor")).toBe(true);
    expect(canEditContracts("ops_manager")).toBe(true);
    expect(canEditContracts("manager")).toBe(true);
  });

  it("denies null and other roles", () => {
    expect(canEditContracts(null)).toBe(false);
    expect(canEditContracts("viewer" as "admin")).toBe(false);
  });

  it("denies unsupported roles", () => {
    expect(canEditContracts("super_admin" as never)).toBe(false);
    expect(canEditContracts("owner" as never)).toBe(false);
  });
});

describe("canDeleteContracts", () => {
  it("allows only admin and manager", () => {
    expect(canDeleteContracts("admin")).toBe(true);
    expect(canDeleteContracts("manager")).toBe(true);
    expect(canDeleteContracts("editor")).toBe(false);
    expect(canDeleteContracts("ops_manager")).toBe(false);
  });

  it("denies null and unsupported roles", () => {
    expect(canDeleteContracts(null)).toBe(false);
    expect(canDeleteContracts("viewer")).toBe(false);
    expect(canDeleteContracts("super_admin" as never)).toBe(false);
  });
});
