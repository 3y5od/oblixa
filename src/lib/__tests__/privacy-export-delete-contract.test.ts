import { describe, expect, it } from "vitest";

/** Audit log shape for export/delete requests (Phase 10 placeholder). */
export type PrivacyAuditStub = {
  action: "export_requested" | "delete_requested";
  subject: string;
  at: string;
};

describe("privacy export/delete audit contract", () => {
  it("accepts minimal audit envelope", () => {
    const row: PrivacyAuditStub = {
      action: "delete_requested",
      subject: "user:00000000-0000-0000-0000-000000000000",
      at: new Date().toISOString(),
    };
    expect(row.action).toBe("delete_requested");
  });
});
