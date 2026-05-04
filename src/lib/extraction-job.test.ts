import { beforeEach, describe, expect, it, vi } from "vitest";
import { startExtractionJob } from "@/lib/extraction-job";

type EqLog = { table: string; col: string; val: string };

function adminForExistingJob(eqLog: EqLog[]) {
  return {
    from: (table: string) => {
      if (table === "contract_extraction_jobs") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  return {
                    maybeSingle: vi.fn(async () => ({
                      data: { status: "failed", attempt_count: 1, started_at: null },
                      error: null,
                    })),
                  };
                },
              };
            },
          }),
          update: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: vi.fn(async (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  return { error: null };
                }),
              };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function adminForStuckJob(eqLog: EqLog[]) {
  let selectCalls = 0;
  return {
    from: (table: string) => {
      if (table === "contract_extraction_jobs") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  return {
                    maybeSingle: vi.fn(async () => {
                      selectCalls += 1;
                      return {
                        data:
                          selectCalls === 1
                            ? { status: "processing", attempt_count: 1, started_at: new Date().toISOString() }
                            : null,
                        error: null,
                      };
                    }),
                  };
                },
              };
            },
          }),
          delete: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: vi.fn(async (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  return { error: null };
                }),
              };
            },
          }),
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      if (table === "contract_files") {
        return {
          select: () => ({
            eq: vi.fn(async () => ({ count: 0, error: null })),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("startExtractionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes existing-row reads and updates by organization_id", async () => {
    const eqLog: EqLog[] = [];
    const admin = adminForExistingJob(eqLog);

    const result = await startExtractionJob(admin as never, "contract-1", "org-1");

    expect(result).toEqual({ ok: true, attempt: 2 });
    const extractionEqs = eqLog.filter((row) => row.table === "contract_extraction_jobs");
    expect(extractionEqs).toContainEqual({ table: "contract_extraction_jobs", col: "contract_id", val: "contract-1" });
    expect(extractionEqs).toContainEqual({ table: "contract_extraction_jobs", col: "organization_id", val: "org-1" });
  });

  it("scopes stale-job reset deletes by organization_id", async () => {
    const eqLog: EqLog[] = [];
    const admin = adminForStuckJob(eqLog);

    const result = await startExtractionJob(admin as never, "contract-2", "org-2");

    expect(result).toEqual({ ok: true, attempt: 1 });
    const extractionEqs = eqLog.filter((row) => row.table === "contract_extraction_jobs");
    expect(extractionEqs).toContainEqual({ table: "contract_extraction_jobs", col: "contract_id", val: "contract-2" });
    expect(extractionEqs).toContainEqual({ table: "contract_extraction_jobs", col: "organization_id", val: "org-2" });
  });
});