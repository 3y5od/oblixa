import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnsureAccount = vi.fn();
const mockEnsureCp = vi.fn();
const mockTimelineAccount = vi.fn();
const mockTimelineCp = vi.fn();

vi.mock("@/lib/decision-intelligence/relationship-bootstrap", () => ({
  ensureAccountWorkspaceFromContracts: (...args: unknown[]) => mockEnsureAccount(...args),
  ensureCounterpartyWorkspaceFromContracts: (...args: unknown[]) => mockEnsureCp(...args),
  ensureTimelineForAccount: (...args: unknown[]) => mockTimelineAccount(...args),
  ensureTimelineForCounterparty: (...args: unknown[]) => mockTimelineCp(...args),
}));

import {
  appendAccountTimelineEvent,
  appendCounterpartyTimelineEvent,
  appendTimelineEventDeduped,
} from "./relationship-timeline";

describe("relationship-timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appendAccountTimelineEvent returns early when workspace is missing", async () => {
    mockEnsureAccount.mockResolvedValue(null);
    const insert = vi.fn();
    const admin = { from: vi.fn(() => ({ insert })) } as never;
    await appendAccountTimelineEvent(admin, "org", "acc", "evt", { a: 1 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("appendAccountTimelineEvent inserts after workspace + timeline", async () => {
    mockEnsureAccount.mockResolvedValue({ id: "w1", display_name: "Acme" });
    mockTimelineAccount.mockResolvedValue("tl-1");
    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = { from: vi.fn(() => ({ insert })) } as never;
    await appendAccountTimelineEvent(admin, "org-9", "acc", "note", { k: "v" });
    expect(mockTimelineAccount).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-9",
        relationship_timeline_id: "tl-1",
        event_type: "note",
        payload_json: expect.objectContaining({ k: "v", recorded_at: expect.any(String) }),
      })
    );
  });

  it("appendCounterpartyTimelineEvent inserts for counterparty workspace", async () => {
    mockEnsureCp.mockResolvedValue({ id: "w2", display_name: "Cp" });
    mockTimelineCp.mockResolvedValue("tl-2");
    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = { from: vi.fn(() => ({ insert })) } as never;
    await appendCounterpartyTimelineEvent(admin, "org", "cp-key", "evt", {});
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        relationship_timeline_id: "tl-2",
        event_type: "evt",
      })
    );
  });

  it("appendTimelineEventDeduped skips when latest payload_json stringifies like incoming", async () => {
    const insert = vi.fn();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { payload_json: { score: 1 } },
      error: null,
    });
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = maybeSingle;
    builder.insert = insert;
    const admin = { from: vi.fn(() => builder) } as never;
    await appendTimelineEventDeduped(admin, "org", "tl", "metric", { score: 1 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("appendTimelineEventDeduped inserts when payload differs from latest", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { payload_json: { score: 0 } },
      error: null,
    });
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = maybeSingle;
    builder.insert = insert;

    const admin = { from: vi.fn(() => builder) } as never;
    await appendTimelineEventDeduped(admin, "org", "tl", "metric", { score: 1 });
    expect(insert).toHaveBeenCalled();
  });
});
