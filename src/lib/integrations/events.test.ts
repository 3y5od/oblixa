import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  })),
}));

describe("enqueueOutboundEvent", () => {
  beforeEach(() => {
    insertMock.mockReset();
  });

  it("writes schema metadata by default", async () => {
    const { enqueueOutboundEvent } = await import("@/lib/integrations/events");
    await enqueueOutboundEvent({
      organizationId: "org-1",
      eventType: "contract.updated",
      entityType: "contract",
      entityId: "contract-1",
      payload: { hello: "world" },
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.organization_id).toBe("org-1");
    expect(payload.event_type).toBe("contract.updated");
    expect(payload.entity_type).toBe("contract");
    expect(payload.entity_id).toBe("contract-1");
    expect(payload.payload).toMatchObject({
      schema_version: "v1",
      hello: "world",
    });
    expect((payload.payload as Record<string, unknown>).emitted_at).toEqual(
      expect.any(String)
    );
  });

  it("supports explicit schema version override", async () => {
    const { enqueueOutboundEvent } = await import("@/lib/integrations/events");
    await enqueueOutboundEvent({
      organizationId: "org-1",
      eventType: "task.created",
      entityType: "contract_task",
      schemaVersion: "v2",
      payload: {},
    });
    const payload = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.payload).toMatchObject({ schema_version: "v2" });
  });
});
