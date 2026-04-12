import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({
    from: vi.fn(() => ({ insert })),
  })),
}));

const getV6OrgSettingsJson = vi.fn(async () => ({}));

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson,
}));

describe("enqueueOutboundEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    getV6OrgSettingsJson.mockResolvedValue({});
    vi.resetModules();
  });

  it("inserts org-scoped row with schema_version and event metadata", async () => {
    const { enqueueOutboundEvent } = await import("@/lib/integrations/events");
    const ok = await enqueueOutboundEvent({
      organizationId: "org-11111111-1111-1111-1111-111111111111",
      eventType: "custom.test_event",
      entityType: "contract",
      entityId: "ent-1",
      payload: { k: "v" },
      schemaVersion: "v2",
    });
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledWith({
      organization_id: "org-11111111-1111-1111-1111-111111111111",
      event_type: "custom.test_event",
      entity_type: "contract",
      entity_id: "ent-1",
      payload: expect.objectContaining({
        schema_version: "v2",
        k: "v",
        emitted_at: expect.any(String),
      }),
    });
  });

  it("returns false when event type is suppressed in org settings", async () => {
    getV6OrgSettingsJson.mockResolvedValue({
      notification_suppressed_event_types: ["muted.event"],
    });
    const { enqueueOutboundEvent } = await import("@/lib/integrations/events");
    const ok = await enqueueOutboundEvent({
      organizationId: "org-1",
      eventType: "muted.event",
      entityType: "x",
    });
    expect(ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
