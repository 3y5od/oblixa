import { describe, expect, it } from "vitest";
import { rebuildHealthGraphFromPortfolio } from "@/lib/assurance/health-graph";

type ReadResult = { data: unknown[] | null; error: { message: string } | null };
type NodeUpsertResult = { data: { id: string } | null; error: { message: string } | null };
type EdgeUpsertResult = { error: { message: string } | null };

type ReadChain = PromiseLike<ReadResult> & {
  eq: () => ReadChain;
  in: () => ReadChain;
  not: () => ReadChain;
  order: () => ReadChain;
  range: () => Promise<ReadResult>;
  limit: () => never;
};

function createHealthGraphAdminMock(input?: {
  reads?: Record<string, ReadResult[]>;
  nodeUpserts?: NodeUpsertResult[];
  edgeUpserts?: EdgeUpsertResult[];
}) {
  const reads = new Map(Object.entries(input?.reads ?? {}));
  const nodeUpserts = [...(input?.nodeUpserts ?? [])];
  const edgeUpserts = [...(input?.edgeUpserts ?? [])];
  const selectedColumns: Record<string, string[]> = {};
  let nodeCounter = 0;

  const nextRead = (table: string): ReadResult => {
    const queue = reads.get(table);
    if (!queue || queue.length === 0) return { data: [], error: null };
    const next = queue.shift()!;
    reads.set(table, queue);
    return next;
  };

  return {
    selectedColumns,
    from(table: string) {
      return {
        select(columns?: string) {
          selectedColumns[table] = selectedColumns[table] ?? [];
          selectedColumns[table].push(String(columns ?? ""));
          const chain: ReadChain = {
            eq: () => chain,
            in: () => chain,
            not: () => chain,
            order: () => chain,
            range: async () => nextRead(table),
            limit: () => {
              throw new Error(`unexpected limit() on ${table}`);
            },
            then: (onfulfilled, onrejected) => Promise.resolve(nextRead(table)).then(onfulfilled, onrejected),
          };
          return chain;
        },
        upsert() {
          if (table === "portfolio_health_graph_nodes") {
            const next = nodeUpserts.shift() ?? {
              data: { id: `node-${++nodeCounter}` },
              error: null,
            };
            return {
              select() {
                return { single: async () => next };
              },
            };
          }
          if (table === "portfolio_health_graph_edges") {
            return Promise.resolve(edgeUpserts.shift() ?? { error: null });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

describe("rebuildHealthGraphFromPortfolio", () => {
  it("pages scorecards and rebuilds the graph without using limit-based truncation", async () => {
    const pageOne = Array.from({ length: 200 }, (_, index) => ({
      id: `scorecard-${index}`,
      scorecard_type: "counterparty",
      entity_ref_id: `cp-${index}`,
      overall_score: 75,
    }));
    const pageTwo = [
      {
        id: "scorecard-200",
        scorecard_type: "counterparty",
        entity_ref_id: "cp-200",
        overall_score: 75,
      },
    ];
    const admin = createHealthGraphAdminMock({
      reads: {
        assurance_scorecards: [
          { data: pageOne, error: null },
          { data: pageTwo, error: null },
        ],
      },
    });

    const result = await rebuildHealthGraphFromPortfolio(admin as never, "org-1");

    expect(result.errors).toEqual([]);
    expect(result.nodes).toBe(202);
    expect(result.edges).toBe(201);
    expect(result.attemptedNodes).toBe(202);
    expect(result.attemptedEdges).toBe(201);
  });

  it("surfaces node upsert failures as structured errors", async () => {
    const admin = createHealthGraphAdminMock({
      reads: {
        assurance_scorecards: [
          {
            data: [
              {
                id: "scorecard-1",
                scorecard_type: "counterparty",
                entity_ref_id: "cp-1",
                overall_score: 80,
              },
            ],
            error: null,
          },
        ],
      },
      nodeUpserts: [
        { data: { id: "root-node" }, error: null },
        { data: null, error: { message: "node write failed" } },
      ],
    });

    const result = await rebuildHealthGraphFromPortfolio(admin as never, "org-1");

    expect(result.nodes).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({
        diagnostic_id: "v6_health_graph_scorecard_node_upsert_failed",
        phase: "persist",
        message: "node write failed",
      }),
    ]);
  });

  it("surfaces edge upsert failures as structured errors", async () => {
    const admin = createHealthGraphAdminMock({
      reads: {
        assurance_scorecards: [
          {
            data: [
              {
                id: "scorecard-1",
                scorecard_type: "counterparty",
                entity_ref_id: "cp-1",
                overall_score: 80,
              },
            ],
            error: null,
          },
        ],
      },
      nodeUpserts: [
        { data: { id: "root-node" }, error: null },
        { data: { id: "counterparty-node" }, error: null },
      ],
      edgeUpserts: [{ error: { message: "edge write failed" } }],
    });

    const result = await rebuildHealthGraphFromPortfolio(admin as never, "org-1");

    expect(result.edges).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({
        diagnostic_id: "v6_health_graph_org_rollup_edge_upsert_failed",
        phase: "persist",
        message: "edge write failed",
      }),
    ]);
  });

  it("uses contracts.account_key for account-derived graph links", async () => {
    const admin = createHealthGraphAdminMock({
      reads: {
        assurance_scorecards: [
          {
            data: [
              {
                id: "scorecard-counterparty",
                scorecard_type: "counterparty",
                entity_ref_id: "Acme",
                overall_score: 82,
              },
              {
                id: "scorecard-account",
                scorecard_type: "account",
                entity_ref_id: "acct-1",
                overall_score: 84,
              },
            ],
            error: null,
          },
        ],
        contracts: [
          { data: [], error: null },
          {
            data: [
              { counterparty: "Acme", account_key: "acct-1" },
              { counterparty: "Acme", account_key: "acct-1" },
            ],
            error: null,
          },
          {
            data: [
              {
                id: "contract-1",
                name: "MSA",
                counterparty: "Acme",
                account_key: "acct-1",
              },
            ],
            error: null,
          },
        ],
        assurance_findings: [
          {
            data: [
              {
                id: "finding-1",
                title: "Missing evidence",
                severity: "high",
                finding_type: "control_gap",
                linked_entities_json: [{ type: "contract", id: "contract-1" }],
              },
            ],
            error: null,
          },
        ],
      },
    });

    const result = await rebuildHealthGraphFromPortfolio(admin as never, "org-1");

    expect(result.errors).toEqual([]);
    expect(admin.selectedColumns.contracts).toContain("counterparty, account_key");
    expect(admin.selectedColumns.contracts).toContain("id, name, counterparty, account_key");
    const staleContractAccountColumn = ["linked", "account", "key"].join("_");
    expect(admin.selectedColumns.contracts.some((columns) => columns.includes(staleContractAccountColumn))).toBe(false);
  });
});
