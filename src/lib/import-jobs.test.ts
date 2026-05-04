import { beforeEach, describe, expect, it, vi } from "vitest";

const { autoAttachProgramsForContract, emitProductTelemetryEvent, mapWithConcurrency } = vi.hoisted(() => ({
  autoAttachProgramsForContract: vi.fn(async () => ({ attachedPrograms: [] })),
  emitProductTelemetryEvent: vi.fn(async () => undefined),
  mapWithConcurrency: vi.fn(async <T>(items: T[], _concurrency: number, worker: (item: T) => Promise<unknown>) => {
    for (const item of items) await worker(item);
    return [];
  }),
}));

vi.mock("@/lib/v4/program-auto-attach", () => ({ autoAttachProgramsForContract }));
vi.mock("@/lib/product-telemetry", () => ({ emitProductTelemetryEvent }));
vi.mock("@/lib/extraction/concurrency", () => ({ mapWithConcurrency }));

import { runContractCsvImport } from "@/lib/import-jobs";

function makeAdmin(ownerMembers: Array<{ user_id: string; profiles: { email: string | null } }> = []) {
  const eqLog: Array<{ table: string; col: string; val: string }> = [];
  const inLog: Array<{ table: string; col: string; vals: string[] }> = [];
  const contractInsert = vi.fn((rows: Record<string, unknown>[]) => ({
    select: vi.fn(async () => ({ data: rows.map((_, index) => ({ id: `contract-${index + 1}` })), error: null })),
  }));
  const jobRowsInsert = vi.fn(async () => ({ error: null }));

  const admin = {
    from: (table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                in: vi.fn(async (inCol: string, vals: string[]) => {
                  inLog.push({ table, col: inCol, vals });
                  return { data: ownerMembers, error: null };
                }),
              };
            }),
          })),
        };
      }
      if (table === "contract_import_jobs") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "job-1" }, error: null })) })),
          })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
      }
      if (table === "contracts") return { insert: contractInsert };
      if (table === "contract_import_job_rows") return { insert: jobRowsInsert };
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { admin, eqLog, inLog, contractInsert, jobRowsInsert };
}

describe("runContractCsvImport owner assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves owner emails through workspace membership scope", async () => {
    const { admin, eqLog, inLog, contractInsert } = makeAdmin([
      { user_id: "member-1", profiles: { email: "owner@acme.test" } },
    ]);

    const result = await runContractCsvImport({
      admin: admin as never,
      membership: { organization_id: "org-1" },
      userId: "user-1",
      rows: [{ title: "MSA", counterparty: "Acme", owner_email: "owner@acme.test" }],
    });

    expect(result).toMatchObject({ success: true, created: 1, errors: 0, jobId: "job-1" });
    expect(eqLog).toContainEqual({ table: "organization_members", col: "organization_id", val: "org-1" });
    expect(inLog).toContainEqual({ table: "organization_members", col: "profiles.email", vals: ["owner@acme.test"] });
    expect(contractInsert).toHaveBeenCalledWith([
      expect.objectContaining({ organization_id: "org-1", owner_id: "member-1", created_by: "user-1" }),
    ]);
  });

  it("rejects owner emails that are not present in the workspace membership", async () => {
    const { admin, contractInsert, jobRowsInsert } = makeAdmin([]);

    const result = await runContractCsvImport({
      admin: admin as never,
      membership: { organization_id: "org-1" },
      userId: "user-1",
      rows: [{ title: "MSA", counterparty: "Acme", owner_email: "missing@acme.test" }],
    });

    expect(result).toMatchObject({ success: true, created: 0, errors: 1, jobId: "job-1" });
    expect(contractInsert).not.toHaveBeenCalled();
    expect(jobRowsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        job_id: "job-1",
        organization_id: "org-1",
        owner_email: "missing@acme.test",
        status: "error",
        error_message: "Owner email not found in workspace",
      }),
    ]);
  });
});