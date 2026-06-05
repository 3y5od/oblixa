import { describe, expect, it, vi } from "vitest";
import {
  insertAccessRequestRecord,
  markWorkspaceAccessGrantUsed,
  type AccessRequestInsert,
} from "@/lib/access-review";

const accessRequestInput: AccessRequestInsert = {
  normalizedEmail: "requester@example.com",
  requesterName: "Requester",
  companyName: "Acme",
  requesterRole: "Founder",
  approximateContractCount: "50_200",
  currentTrackingMethod: "spreadsheet",
  hasTracker: "unsure",
  redactedSampleAvailable: "unsure",
  followUpPreference: "async",
  painSummary: "Renewals are missed.",
  message: "",
  source: "request_access",
};

function chainedBuilder(result: unknown) {
  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

describe("markWorkspaceAccessGrantUsed", () => {
  it("fails when no issued grant row was consumed", async () => {
    const grantBuilder = chainedBuilder({ data: null, error: null });
    const admin = { from: vi.fn(() => grantBuilder) };

    const result = await markWorkspaceAccessGrantUsed(admin as never, {
      grantId: "grant-1",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: false, error: "grant_consume_stale" });
    expect(grantBuilder.select).toHaveBeenCalledWith("id");
  });
});

describe("insertAccessRequestRecord", () => {
  it("recovers an insert unique-conflict race as a duplicate update", async () => {
    const lookupMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "request-1", duplicate_count: 0 }, error: null });
    const lookupEq = vi.fn(() => ({ maybeSingle: lookupMaybeSingle }));
    const lookupSelect = vi.fn(() => ({ eq: lookupEq }));
    const insertSingle = vi.fn(async () => ({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    }));
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const requestInsert = vi.fn(() => ({ select: insertSelect }));
    const updateEq = vi.fn(async () => ({ error: null }));
    const requestUpdate = vi.fn(() => ({ eq: updateEq }));
    const eventInsert = vi.fn(async () => ({ error: null }));
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "workspace_access_requests") {
          return { select: lookupSelect, insert: requestInsert, update: requestUpdate };
        }
        if (table === "workspace_access_request_events") {
          return { insert: eventInsert };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await insertAccessRequestRecord(admin as never, accessRequestInput);

    expect(result).toEqual({ ok: true, id: "request-1" });
    expect(requestUpdate).toHaveBeenCalledWith(expect.objectContaining({ duplicate_count: 1 }));
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "request-1",
        action: "access_request.duplicate_received",
      })
    );
  });
});
