import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureCronAuthorized = vi.fn();
const rateLimitCheck = vi.fn();
const pingCronHealthcheck = vi.fn();
const enqueueOutboundEvent = vi.fn();
const recordAutomationEvent = vi.fn();

const selectOrMock = vi.fn();
const updateInMock = vi.fn();

vi.mock("@/lib/v4/cron", () => ({
  ensureCronAuthorized,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v4EscalationDispatchCron: { max: 10, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck,
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent,
}));

vi.mock("@/lib/v4/automation-audit", () => ({
  recordAutomationEvent,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => {
    const selectChain = {
      select: vi.fn(() => selectChain),
      in: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      or: selectOrMock,
      limit: vi.fn(async () => ({
        data: [
          { id: "exception-1", organization_id: "org-1", contract_id: "contract-1" },
          { id: "exception-2", organization_id: "org-1", contract_id: "contract-2" },
        ],
      })),
    };

    const updateChain = {
      update: vi.fn(() => updateChain),
      in: updateInMock,
    };

    let exceptionsFromCalls = 0;
    return {
      from: vi.fn((table: string) => {
        if (table !== "exceptions") {
          throw new Error(`Unexpected table ${table}`);
        }
        exceptionsFromCalls += 1;
        return exceptionsFromCalls === 1 ? selectChain : updateChain;
      }),
    };
  }),
}));

describe("GET /api/cron/v4/escalations-dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCronAuthorized.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    selectOrMock.mockImplementation(function (this: unknown) {
      return this;
    });
    enqueueOutboundEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    recordAutomationEvent.mockResolvedValue(undefined);
    updateInMock.mockResolvedValue({ error: null });
  });

  it("dispatches only successful escalations and updates timestamp for those ids", async () => {
    const { GET } = await import("@/app/api/cron/v4/escalations-dispatch/route");
    const response = await GET(new Request("http://localhost:3000/api/cron/v4/escalations-dispatch"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(selectOrMock).toHaveBeenCalledTimes(1);
    expect(selectOrMock.mock.calls[0][0]).toContain("last_escalated_at.is.null,last_escalated_at.lt.");
    expect(enqueueOutboundEvent).toHaveBeenCalledTimes(2);
    expect(recordAutomationEvent).toHaveBeenCalledTimes(1);
    expect(updateInMock).toHaveBeenCalledWith("id", ["exception-1"]);
    expect(body).toMatchObject({ dispatched: 1, ok: true });
    expect(pingCronHealthcheck).toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2500 });
    const { GET } = await import("@/app/api/cron/v4/escalations-dispatch/route");
    const response = await GET(new Request("http://localhost:3000/api/cron/v4/escalations-dispatch"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many requests", retryAfterMs: 2500 });
  });
});
