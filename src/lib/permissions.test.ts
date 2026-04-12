import { describe, expect, it } from "vitest";
import { canEditContracts } from "@/lib/permissions";

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
});
