import { describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

const { listHealthGraph } = vi.hoisted(() => ({
  listHealthGraph: vi.fn(),
}));

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v6/assurance", () => ({
  listHealthGraph,
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
}));

describe("GET /api/assurance/health-graph", () => {
  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(JSON.stringify({ error: "disabled" }), { status: 403 }));
    const { GET } = await import("@/app/api/assurance/health-graph/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns propagation_paths and propagation_paths_3hop as arrays (empty graph)", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({
      admin: {},
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    listHealthGraph.mockResolvedValueOnce({ nodes: [], edges: [], error: null });

    const { GET } = await import("@/app/api/assurance/health-graph/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      propagation_paths: unknown[];
      propagation_paths_3hop: unknown[];
      nodes: unknown[];
      edges: unknown[];
    };
    expect(Array.isArray(body.propagation_paths)).toBe(true);
    expect(Array.isArray(body.propagation_paths_3hop)).toBe(true);
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
  });

  it("returns stable path summary keys when graph has a two-hop chain", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({
      admin: {},
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    const nodes = [
      { id: "n1", node_type: "contract", node_ref_id: "c1", label: "A", risk_score: 0, concentration_score: 0 },
      { id: "n2", node_type: "contract", node_ref_id: "c2", label: "B", risk_score: 0, concentration_score: 0 },
      { id: "n3", node_type: "contract", node_ref_id: "c3", label: "C", risk_score: 0, concentration_score: 0 },
    ];
    const edges = [
      {
        id: "e1",
        source_node_id: "n1",
        target_node_id: "n2",
        relationship_type: "depends_on",
        propagation_risk: 0.8,
      },
      {
        id: "e2",
        source_node_id: "n2",
        target_node_id: "n3",
        relationship_type: "shared_counterparty",
        propagation_risk: 0.5,
      },
    ];
    listHealthGraph.mockResolvedValueOnce({ nodes, edges, error: null });

    const { GET } = await import("@/app/api/assurance/health-graph/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      propagation_paths: Array<Record<string, unknown>>;
      propagation_paths_3hop: Array<Record<string, unknown>>;
    };
    expect(body.propagation_paths.length).toBeGreaterThanOrEqual(1);
    const p0 = body.propagation_paths[0];
    expect(p0).toMatchObject({
      path_label: expect.any(String),
      hops: expect.any(Number),
      bottleneck_risk: expect.any(Number),
      relationship_types: expect.any(Array),
      edge_ids: expect.any(Array),
    });
    expect(body.propagation_paths_3hop).toEqual(expect.any(Array));
  });
});
