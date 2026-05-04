import { beforeEach, describe, expect, it, vi } from "vitest";

const gateCronRequest = vi.fn();
const rateLimitCheck = vi.fn();
const createAdminClient = vi.fn();
const upsertDetectedExceptions = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();

vi.mock("@/lib/security/cron-route-gate", () => ({
  gateCronRequest,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v4EvidenceFollowupCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/v4/exceptions", () => ({
  upsertDetectedExceptions,
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  recordV10AuditEvent,
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

describe("GET /api/cron/v4/evidence-followup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    upsertDetectedExceptions.mockResolvedValue({ touched: 0 });
    recordV10AuditEvent.mockResolvedValue("audit_1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
  });

  it("returns unauthorized response from cron guard", async () => {
    gateCronRequest.mockReturnValueOnce(new Response("Unauthorized", { status: 401 }));
    const { GET } = await import("@/app/api/cron/v4/evidence-followup/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/evidence-followup"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2200 });
    const { GET } = await import("@/app/api/cron/v4/evidence-followup/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/evidence-followup"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Too many requests",
      code: "rate_limited",
      retryAfterMs: 2200,
    });
  });

  it("queues V10 staged evidence follow-up reminders and escalation work", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T12:00:00Z"));
    const notificationInsert = vi.fn().mockResolvedValue({ error: null });
    const taskInsert = vi.fn().mockResolvedValue({ error: null });
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const requirements = [
      {
        id: "req_due_minus_3",
        organization_id: "org_1",
        contract_id: "contract_1",
        title: "SOC 2",
        due_at: "2026-04-28T12:00:00Z",
        reviewer_id: "user_1",
      },
      {
        id: "req_escalate",
        organization_id: "org_1",
        contract_id: "contract_2",
        title: "Insurance",
        due_at: "2026-04-24T12:00:00Z",
        reviewer_id: "user_2",
      },
    ];
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "evidence_requirements") {
          return {
            select: () => ({
              in: () => ({
                lte: () => ({
                  limit: vi.fn().mockResolvedValue({ data: requirements }),
                }),
              }),
            }),
          };
        }
        if (table === "contract_tasks") {
          return {
            select: () => ({
              in: vi.fn().mockResolvedValue({ data: [] }),
            }),
            insert: taskInsert,
          };
        }
        if (table === "notification_deliveries") {
          return {
            select: () => ({
              in: () => ({
                in: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
            insert: notificationInsert,
          };
        }
        if (table === "audit_events") {
          return { insert: auditInsert };
        }
        return {};
      }),
    };
    createAdminClient.mockResolvedValue(admin);
    upsertDetectedExceptions.mockResolvedValue({ touched: 1 });

    const { GET } = await import("@/app/api/cron/v4/evidence-followup/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/evidence-followup"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      reviewed: 2,
      notificationsQueued: 6,
      dueMinus3RemindersQueued: 2,
      dueDateRemindersQueued: 1,
      overdueNotificationsQueued: 1,
      ownerNotificationsQueued: 1,
      escalationTasksCreated: 1,
    });
    const insertedNotifications = notificationInsert.mock.calls[0]?.[0] ?? [];
    expect(insertedNotifications.map((row: { metadata: { follow_up_stage: string } }) => row.metadata.follow_up_stage)).toEqual(
      expect.arrayContaining(["due_minus_3", "due_date", "overdue_state", "owner_notification", "escalation"])
    );
    expect(taskInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        evidence_requirement_id: "req_escalate",
        title: "Evidence follow-up: Insurance",
      }),
    ]);
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        organizationId: "org_1",
        action: "evidence_request.follow_up_scheduled",
      })
    );
  });
});
