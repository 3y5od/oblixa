import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
}));

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("V5 intelligence GET routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  it("portfolio-signals returns 403 when feature disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/intelligence/portfolio-signals/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("decision-queue returns 403 when feature disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/intelligence/decision-queue/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("portfolio-by-program returns 403 when feature disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/intelligence/portfolio-by-program/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("portfolio-by-counterparty returns 403 when feature disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/intelligence/portfolio-by-counterparty/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("recommendations list returns 403 when feature disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/intelligence/recommendations/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("portfolio-signals returns normalized signal shape when authenticated", async () => {
    const countRes = { count: 3, error: null };
    const dataRes = { data: [{ id: "camp-1" }], error: null };
    const emptyData = { data: [], error: null };

    function filterBuilder(mode: "count" | "data") {
      const p = Promise.resolve(mode === "count" ? countRes : dataRes);
      const f: Record<string, ReturnType<typeof vi.fn>> = {};
      f.eq = vi.fn(() => f);
      f.in = vi.fn(() => f);
      f.lte = vi.fn(() => f);
      f.lt = vi.fn(() => f);
      f.limit = vi.fn(async () => (mode === "data" ? dataRes : emptyData));
      return Object.assign(f, {
        then: (onFulfilled: (v: unknown) => unknown) => p.then(onFulfilled),
        catch: p.catch.bind(p),
      });
    }

    const adminFrom = vi.fn((table: string) => {
      if (table === "exceptions") {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts?.head) {
              return filterBuilder("count");
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(async () => emptyData),
                })),
              })),
            };
          }),
        };
      }
      if (table === "portfolio_campaigns") {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts?.head) {
              return filterBuilder("count");
            }
            return filterBuilder("data");
          }),
        };
      }
      if (
        table === "decision_workspaces" ||
        table === "attestation_requests" ||
        table === "contract_tasks" ||
        table === "external_action_links" ||
        table === "evidence_requirements" ||
        table === "contract_renewal_checkpoints" ||
        table === "contract_program_assignments" ||
        table === "portfolio_campaign_contracts"
      ) {
        return {
          select: vi.fn(() => filterBuilder("count")),
        };
      }
      if (table === "contract_obligations") {
        return {
          select: vi.fn(() => filterBuilder("count")),
        };
      }
      if (table === "contract_approvals") {
        return {
          select: vi.fn(() => filterBuilder("count")),
        };
      }
      return { select: vi.fn(() => filterBuilder("count")) };
    });
    getApiAuthContext.mockResolvedValueOnce({
      admin: { from: adminFrom },
      orgId: "org-1",
    } as never);

    const { GET } = await import("@/app/api/intelligence/portfolio-signals/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signalSummary).toHaveLength(13);
    for (const s of body.signalSummary) {
      expect(s).toMatchObject({
        key: expect.any(String),
        label: expect.any(String),
        value: expect.any(Number),
        severity: expect.any(String),
        linked_object: expect.any(String),
        reason: expect.any(String),
        reason_json: expect.any(Array),
        linked_refs: expect.any(Array),
      });
      expect((s as { reason_json: unknown[] }).reason_json.length).toBeGreaterThan(0);
      expect((s as { linked_refs: unknown[] }).linked_refs.length).toBeGreaterThan(0);
    }
    expect(body.drivers).toMatchObject({
      linked_object: "exceptions",
      reason_json: expect.any(Array),
    });
  });

  it("recommendations list normalizes reason_json and target_refs", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    {
                      id: "r1",
                      recommendation_type: "t",
                      priority: "high",
                      target_ref_type: "decision_queue",
                      target_ref_id: "org-1",
                      recommendation_text: "Hello",
                      reason_json: [],
                      confidence: 50,
                      accepted: false,
                      dismissed: false,
                      generated_at: "2026-01-01T00:00:00Z",
                      expires_at: null,
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
      orgId: "org-1",
    } as never);

    const { GET } = await import("@/app/api/intelligence/recommendations/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recommendations).toHaveLength(1);
    expect(body.recommendations[0].reason_json.length).toBeGreaterThan(0);
    expect(body.recommendations[0].target_refs).toEqual([
      { ref_type: "decision_queue", ref_id: "org-1" },
    ]);
  });

  it("decision-queue enriches rows with sla fields", async () => {
    const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    getApiAuthContext.mockResolvedValueOnce({
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [
                      {
                        id: "d1",
                        title: "T",
                        decision_type: "renewal",
                        status: "open",
                        due_at: due,
                        owner_user_id: null,
                        linked_contract_ids: [],
                        updated_at: "2026-01-01T00:00:00Z",
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      },
      orgId: "org-1",
    } as never);

    const { GET } = await import("@/app/api/intelligence/decision-queue/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queue).toHaveLength(1);
    expect(body.queue[0]).toMatchObject({
      id: "d1",
      sla_status: expect.stringMatching(/due_soon|on_track|overdue|no_due_date/),
      days_until_due: expect.anything(),
      priority: expect.stringMatching(/high|medium|low|unspecified/),
    });
  });
});
