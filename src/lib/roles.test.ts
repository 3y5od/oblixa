import { describe, expect, it } from "vitest";
import {
  canDeleteCoreWorkspaceRecords,
  canInviteWorkspaceMembers,
  canManageTeamRoles,
  canManageWorkspaceBilling,
  canMutateCoreWorkspaceRecords,
  canRemoveOrDowngradeOwner,
  canTransferOwnership,
  normalizeWorkspaceRoleAlias,
} from "@/lib/roles";

describe("canonical workspace roles", () => {
  it("maps legacy implementation roles into the release roles", () => {
    expect(normalizeWorkspaceRoleAlias("admin")).toBe("admin");
    expect(normalizeWorkspaceRoleAlias("editor")).toBe("member");
    expect(normalizeWorkspaceRoleAlias("ops_manager")).toBe("member");
    expect(normalizeWorkspaceRoleAlias("legal_reviewer")).toBe("member");
    expect(normalizeWorkspaceRoleAlias("finance_reviewer")).toBe("member");
    expect(normalizeWorkspaceRoleAlias("manager")).toBe("member");
    expect(normalizeWorkspaceRoleAlias("viewer")).toBe("viewer");
  });

  it("treats the workspace owner relation as Owner regardless of stored role", () => {
    expect(normalizeWorkspaceRoleAlias("admin", { isWorkspaceOwner: true })).toBe("owner");
    expect(canInviteWorkspaceMembers("editor", { isWorkspaceOwner: true })).toBe(true);
    expect(canManageWorkspaceBilling("viewer", { isWorkspaceOwner: true })).toBe(true);
  });

  it("keeps Member operational but not destructive or administrative", () => {
    expect(canMutateCoreWorkspaceRecords("editor")).toBe(true);
    expect(canMutateCoreWorkspaceRecords("manager")).toBe(true);
    expect(canDeleteCoreWorkspaceRecords("manager")).toBe(false);
    expect(canManageWorkspaceBilling("manager")).toBe(false);
  });

  it("keeps Viewer read-only by default", () => {
    expect(canMutateCoreWorkspaceRecords("viewer")).toBe(false);
    expect(canDeleteCoreWorkspaceRecords("viewer")).toBe(false);
    expect(canInviteWorkspaceMembers("viewer")).toBe(false);
  });

  it("lets Owner or Admin change non-owner team roles, but not Member/Viewer", () => {
    expect(canManageTeamRoles("admin")).toBe(true);
    expect(canManageTeamRoles("editor", { isWorkspaceOwner: true })).toBe(true);
    expect(canManageTeamRoles("editor")).toBe(false);
    expect(canManageTeamRoles("viewer")).toBe(false);
  });

  it("restricts ownership transfer and owner removal/downgrade to the Owner", () => {
    // Admin (not the workspace owner) cannot transfer or remove/downgrade an owner.
    expect(canTransferOwnership("admin", { isWorkspaceOwner: false })).toBe(false);
    expect(canRemoveOrDowngradeOwner("admin", { isWorkspaceOwner: false })).toBe(false);
    // The workspace owner can.
    expect(canTransferOwnership("admin", { isWorkspaceOwner: true })).toBe(true);
    expect(canRemoveOrDowngradeOwner("owner")).toBe(true);
    // Members/viewers never can.
    expect(canTransferOwnership("editor")).toBe(false);
    expect(canRemoveOrDowngradeOwner("viewer")).toBe(false);
  });
});
