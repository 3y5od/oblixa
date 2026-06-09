import { describe, expect, it, vi } from "vitest";
import {
  insertAccessRequestRecord,
  markWorkspaceAccessGrantUsed,
  recoverApprovedWorkspaceAccessRequestForAuthenticatedUser,
  recoverWorkspaceAccessGrantForAuthenticatedUser,
  resolveApprovedAccessRequestWorkspaceName,
  validateConsumedWorkspaceAccessGrantForUser,
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

describe("validateConsumedWorkspaceAccessGrantForUser", () => {
  it("accepts only a consumed grant owned by the same email and user", async () => {
    const grantBuilder = chainedBuilder({
      data: {
        id: "grant-1",
        request_id: "request-1",
        normalized_email: "requester@example.com",
        status: "used",
        expires_at: "2026-12-01T00:00:00.000Z",
        issued_by: "operator-1",
        used_by: "user-1",
        used_at: "2026-06-01T00:00:00.000Z",
        revoked_at: null,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      error: null,
    });
    const admin = { from: vi.fn(() => grantBuilder) };

    const result = await validateConsumedWorkspaceAccessGrantForUser(admin as never, {
      token: "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz",
      email: "requester@example.com",
      userId: "user-1",
    });

    expect(result).toEqual({
      ok: true,
      grant: expect.objectContaining({ id: "grant-1", status: "used", used_by: "user-1" }),
    });
  });

  it("rejects a consumed grant used by another auth user", async () => {
    const grantBuilder = chainedBuilder({
      data: {
        id: "grant-1",
        request_id: "request-1",
        normalized_email: "requester@example.com",
        status: "used",
        expires_at: "2026-12-01T00:00:00.000Z",
        issued_by: "operator-1",
        used_by: "other-user",
        used_at: "2026-06-01T00:00:00.000Z",
        revoked_at: null,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      error: null,
    });
    const admin = { from: vi.fn(() => grantBuilder) };

    const result = await validateConsumedWorkspaceAccessGrantForUser(admin as never, {
      token: "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz",
      email: "requester@example.com",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: false, error: "grant_user_mismatch" });
  });
});

describe("recoverWorkspaceAccessGrantForAuthenticatedUser", () => {
  it("consumes the newest issued email-bound grant for the authenticated user", async () => {
    const grantListBuilder = {
      select: vi.fn(() => grantListBuilder),
      eq: vi.fn(() => grantListBuilder),
      in: vi.fn(() => grantListBuilder),
      order: vi.fn(() => grantListBuilder),
      limit: vi.fn(async () => ({
        data: [
          {
            id: "grant-1",
            request_id: "request-1",
            normalized_email: "requester@example.com",
            status: "issued",
            expires_at: "2026-12-01T00:00:00.000Z",
            issued_by: "operator-1",
            used_by: null,
            used_at: null,
            revoked_at: null,
            created_at: "2026-06-01T00:00:00.000Z",
          },
        ],
        error: null,
      })),
    };
    const consumeBuilder = {
      eq: vi.fn(() => consumeBuilder),
      gt: vi.fn(() => consumeBuilder),
      select: vi.fn(() => consumeBuilder),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "grant-1",
          request_id: "request-1",
          normalized_email: "requester@example.com",
          status: "used",
          expires_at: "2026-12-01T00:00:00.000Z",
          issued_by: "operator-1",
          used_by: "user-1",
          used_at: "2026-06-01T12:00:00.000Z",
          revoked_at: null,
          created_at: "2026-06-01T00:00:00.000Z",
        },
        error: null,
      })),
    };
    const update = vi.fn(() => consumeBuilder);
    const admin = {
      from: vi.fn(() => ({
        ...grantListBuilder,
        update,
      })),
    };

    const result = await recoverWorkspaceAccessGrantForAuthenticatedUser(admin as never, {
      email: "Requester@Example.com",
      userId: "user-1",
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      grant: expect.objectContaining({ id: "grant-1", status: "used", used_by: "user-1" }),
    });
    expect(update).toHaveBeenCalledWith({
      status: "used",
      used_by: "user-1",
      used_at: "2026-06-01T12:00:00.000Z",
    });
    expect(consumeBuilder.gt).toHaveBeenCalledWith("expires_at", "2026-06-01T12:00:00.000Z");
  });

  it("does not recover a consumed grant owned by another auth user", async () => {
    const grantListBuilder = {
      select: vi.fn(() => grantListBuilder),
      eq: vi.fn(() => grantListBuilder),
      in: vi.fn(() => grantListBuilder),
      order: vi.fn(() => grantListBuilder),
      limit: vi.fn(async () => ({
        data: [
          {
            id: "grant-1",
            request_id: "request-1",
            normalized_email: "requester@example.com",
            status: "used",
            expires_at: "2026-12-01T00:00:00.000Z",
            issued_by: "operator-1",
            used_by: "other-user",
            used_at: "2026-06-01T00:00:00.000Z",
            revoked_at: null,
            created_at: "2026-06-01T00:00:00.000Z",
          },
        ],
        error: null,
      })),
    };
    const update = vi.fn();
    const admin = {
      from: vi.fn(() => ({
        ...grantListBuilder,
        update,
      })),
    };

    const result = await recoverWorkspaceAccessGrantForAuthenticatedUser(admin as never, {
      email: "requester@example.com",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: false, error: "grant_not_recoverable" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("recoverApprovedWorkspaceAccessRequestForAuthenticatedUser", () => {
  it("recovers an approved access request only when no grant row exists", async () => {
    const requestBuilder = {
      select: vi.fn(() => requestBuilder),
      eq: vi.fn(() => requestBuilder),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "request-1",
          normalized_email: "requester@example.com",
          requester_name: "Ada",
          company_name: "Acme",
          status: "approved",
        },
        error: null,
      })),
    };
    const grantBuilder = {
      select: vi.fn(() => grantBuilder),
      eq: vi.fn(() => grantBuilder),
      order: vi.fn(() => grantBuilder),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "workspace_access_requests") return requestBuilder;
        if (table === "workspace_access_grants") return grantBuilder;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await recoverApprovedWorkspaceAccessRequestForAuthenticatedUser(admin as never, {
      email: "Requester@Example.com",
    });

    expect(result).toEqual({
      ok: true,
      request: expect.objectContaining({ id: "request-1", company_name: "Acme" }),
    });
    if (!result.ok) throw new Error("expected approved request recovery");
    expect(resolveApprovedAccessRequestWorkspaceName(result.request)).toBe("Acme");
    expect(grantBuilder.eq).toHaveBeenCalledWith("request_id", "request-1");
  });

  it("does not recover an approved request when a grant row exists", async () => {
    const requestBuilder = {
      select: vi.fn(() => requestBuilder),
      eq: vi.fn(() => requestBuilder),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "request-1",
          normalized_email: "requester@example.com",
          requester_name: "Ada",
          company_name: "Acme",
          status: "approved",
        },
        error: null,
      })),
    };
    const grantBuilder = {
      select: vi.fn(() => grantBuilder),
      eq: vi.fn(() => grantBuilder),
      order: vi.fn(() => grantBuilder),
      limit: vi.fn(async () => ({ data: [{ id: "grant-1", status: "revoked" }], error: null })),
    };
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "workspace_access_requests") return requestBuilder;
        if (table === "workspace_access_grants") return grantBuilder;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await recoverApprovedWorkspaceAccessRequestForAuthenticatedUser(admin as never, {
      email: "requester@example.com",
    });

    expect(result).toEqual({ ok: false, error: "grant_present" });
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
