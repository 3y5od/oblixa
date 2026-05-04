import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireV6CronFeature = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({ requireV6CronFeature }));
vi.mock("@/lib/v6/cron", () => ({
  listOrganizationIds: vi.fn(async () => ["org-a"]),
  v6CronRunMetadata: (orgsProcessed: number, _startedAtMs: number, errorsCount = 0) => ({
    duration_ms: 1,
    orgs_processed: orgsProcessed,
    errors_count: errorsCount,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));
vi.mock("@/lib/v6/cron-jobs", () => ({
  runAssuranceChecksForAllOrgs: vi.fn(async () => ({ checkRuns: 1 })),
  refreshFindingsAging: vi.fn(async () => ({ updated: 1 })),
  runAutopilotDryRun: vi.fn(async () => ({ logs: 1 })),
  runAutopilotExecution: vi.fn(async () => ({ executed: 1 })),
  recomputeScorecardsForAllOrgs: vi.fn(async () => ({ updated: 1 })),
  rebuildHealthGraph: vi.fn(async () => ({ nodes: 1 })),
  reevaluateControlPolicies: vi.fn(async () => ({ evaluations: 1 })),
  recomputeOutcomeEffectiveness: vi.fn(async () => ({ analyzed: 1 })),
  generateReviewBoardPackets: vi.fn(async () => ({ generated: 1 })),
  recomputeSegmentMembershipsForAll: vi.fn(async () => ({ recomputed: 1 })),
  scanExternalWorkflowDeadlines: vi.fn(async () => ({ escalated: 0 })),
  runPlaybookFollowUpAssurancePasses: vi.fn(async () => ({ assuranceRuns: 1 })),
}));

function cronRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    headers: { Authorization: "Bearer cronsecret" },
  });
}

describe("v6 cron feature skip", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cronsecret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("skips cron route when feature disabled", async () => {
    requireV6CronFeature.mockReturnValueOnce(
      new Response(JSON.stringify({ skipped: true }), { status: 200 })
    );
    const { GET } = await import("@/app/api/cron/v6/assurance-checks/route");
    const res = await GET(cronRequest("/api/cron/v6/assurance-checks"));
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });

  it("returns cron auth error when unauthorized", async () => {
    const { GET } = await import("@/app/api/cron/v6/scorecard-recompute/route");
    const res = await GET(new Request("http://localhost/api/cron/v6/scorecard-recompute"));
    expect(res.status).toBe(401);
  });

  it("runs cron when authorized and enabled", async () => {
    requireV6CronFeature.mockReturnValueOnce(null);
    createAdminClient.mockResolvedValueOnce({ from: vi.fn() });
    const { GET } = await import("@/app/api/cron/v6/segment-recompute/route");
    const res = await GET(cronRequest("/api/cron/v6/segment-recompute"));
    expect(res.status).toBe(200);
  });

  it("runs playbook-follow-up-assurance cron when authorized and enabled", async () => {
    requireV6CronFeature.mockReturnValueOnce(null);
    createAdminClient.mockResolvedValueOnce({ from: vi.fn() });
    const { GET } = await import("@/app/api/cron/v6/playbook-follow-up-assurance/route");
    const res = await GET(cronRequest("/api/cron/v6/playbook-follow-up-assurance"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.assuranceRuns).toBe("number");
  });

  it("runs external-workflow-deadlines cron when authorized and enabled", async () => {
    requireV6CronFeature.mockReturnValueOnce(null);
    createAdminClient.mockResolvedValueOnce({ from: vi.fn() });
    const { GET } = await import("@/app/api/cron/v6/external-workflow-deadlines/route");
    const res = await GET(cronRequest("/api/cron/v6/external-workflow-deadlines"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.escalated).toBe("number");
  });
});
