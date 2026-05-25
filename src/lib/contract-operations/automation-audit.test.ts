import { describe, expect, it, vi, beforeEach } from "vitest";

const appendCasefileEvent = vi.fn();
vi.mock("@/lib/contract-operations/casefile", () => ({
  appendCasefileEvent,
}));

describe("recordAutomationEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("inserts audit row only when contractId is absent", async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "audit_events") return { insert: auditInsert };
        throw new Error(`unexpected table ${table}`);
      }),
    };
    const { recordAutomationEvent } = await import("@/lib/contract-operations/automation-audit");
    await recordAutomationEvent({
      admin: admin as never,
      organizationId: "org-1",
      action: "test_run",
      details: { x: 1 },
    });
    expect(auditInsert).toHaveBeenCalledWith({
      organization_id: "org-1",
      contract_id: null,
      user_id: null,
      action: "automation.test_run",
      details: { x: 1 },
    });
    expect(appendCasefileEvent).not.toHaveBeenCalled();
  });

  it("appends casefile when contractId is set", async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "audit_events") return { insert: auditInsert };
        throw new Error(`unexpected table ${table}`);
      }),
    };
    const { recordAutomationEvent } = await import("@/lib/contract-operations/automation-audit");
    await recordAutomationEvent({
      admin: admin as never,
      organizationId: "org-1",
      action: "ingest",
      contractId: "c-1",
      entityType: "document",
      entityId: "d-1",
      details: { bytes: 10 },
    });
    expect(appendCasefileEvent).toHaveBeenCalledWith({
      admin,
      organizationId: "org-1",
      contractId: "c-1",
      eventType: "automation.ingest",
      entityType: "document",
      entityId: "d-1",
      details: { bytes: 10 },
    });
  });
});
