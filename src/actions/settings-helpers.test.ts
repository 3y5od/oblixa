import { describe, expect, it, vi } from "vitest";

import {
  isExistingAuthUserInviteConflict,
  loadPendingInviteSeatRows,
  recoverSettingsAction,
  safeInsertSettingsAuditEvent,
} from "@/actions/settings-helpers";

describe("settings helper action boundaries", () => {
  it("returns a controlled error when audit insertion fails", async () => {
    const insert = vi.fn(async () => ({ error: { message: "permission denied" } }));
    const admin = { from: vi.fn(() => ({ insert })) };

    const result = await safeInsertSettingsAuditEvent(admin as never, { action: "settings.update" }, "Audit failed");

    expect(result).toEqual({ error: "Audit failed" });
    expect(admin.from).toHaveBeenCalledWith("audit_events");
    expect(insert).toHaveBeenCalledWith({ action: "settings.update" });
  });

  it("loads only well-shaped pending invite rows scoped to the organization", async () => {
    const gt = vi.fn(async () => ({
      data: [
        { id: "invite-1", email: "owner@example.com", expires_at: "2099-01-01T00:00:00Z" },
        { id: "invite-2", email: null, expires_at: "2099-01-01T00:00:00Z" },
      ],
      error: null,
    }));
    const isRevoked = vi.fn(() => ({ gt }));
    const isConsumed = vi.fn(() => ({ is: isRevoked }));
    const eq = vi.fn(() => ({ is: isConsumed }));
    const select = vi.fn(() => ({ eq }));
    const admin = { from: vi.fn(() => ({ select })) };

    const result = await loadPendingInviteSeatRows(admin as never, "org-1", "2026-01-01T00:00:00Z");

    expect(result).toEqual({
      rows: [{ id: "invite-1", email: "owner@example.com", expires_at: "2099-01-01T00:00:00Z" }],
      error: false,
    });
    expect(admin.from).toHaveBeenCalledWith("organization_invites");
    expect(eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(isConsumed).toHaveBeenCalledWith("consumed_at", null);
    expect(isRevoked).toHaveBeenCalledWith("revoked_at", null);
    expect(gt).toHaveBeenCalledWith("expires_at", "2026-01-01T00:00:00Z");
  });

  it("normalizes recoverable mutation failures without leaking raw exceptions", async () => {
    const result = await recoverSettingsAction("invite", async () => {
      throw new Error("duplicate key violates unique constraint");
    });

    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("unique constraint");
  });

  it("recognizes existing Auth-user invite conflicts", () => {
    expect(isExistingAuthUserInviteConflict("User already registered")).toBe(true);
    expect(isExistingAuthUserInviteConflict("network timeout")).toBe(false);
  });
});
