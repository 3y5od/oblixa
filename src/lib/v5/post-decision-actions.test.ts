import { describe, expect, it, vi } from "vitest";
import { executePostDecisionActions, suggestDefaultPostDecisionActions } from "./post-decision-actions";

describe("suggestDefaultPostDecisionActions", () => {
  it("returns empty when no linked contract id", () => {
    expect(suggestDefaultPostDecisionActions("renewal", null)).toEqual([]);
    expect(suggestDefaultPostDecisionActions("renewal", [])).toEqual([]);
    expect(suggestDefaultPostDecisionActions("renewal", "not-array" as unknown as string[])).toEqual([]);
  });

  it("returns renewal-style tasks for renewal types", () => {
    for (const t of ["renewal", "renewal_recommendation"] as const) {
      const out = suggestDefaultPostDecisionActions(t, ["  cid-1  "]);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ type: "create_task", contractId: "cid-1" });
    }
  });

  it("returns amendment task for amendment_request", () => {
    const out = suggestDefaultPostDecisionActions("amendment_request", ["x"]);
    expect(out[0]).toMatchObject({ type: "create_task", teamKey: "legal" });
  });

  it("returns exception follow-up for remediation types", () => {
    for (const t of ["remediation_acceptance", "waiver_exception"] as const) {
      const out = suggestDefaultPostDecisionActions(t, ["c"]);
      expect(out[0]?.title).toMatch(/Exception|remediation/i);
    }
  });

  it("returns empty for unknown decision types", () => {
    expect(suggestDefaultPostDecisionActions("other", ["c"])).toEqual([]);
  });
});

describe("executePostDecisionActions", () => {
  it("records validation errors for create_task without ids", async () => {
    const admin = { from: vi.fn() } as never;
    const res = await executePostDecisionActions({
      admin,
      organizationId: "o",
      userId: "u",
      decisionWorkspaceId: "d",
      actions: [{ type: "create_task", title: "T" }],
    });
    expect(res.tasksCreated).toBe(0);
    expect(res.errors.some((e) => e.includes("contractId"))).toBe(true);
  });

  it("creates a task when contract exists and no duplicate marker", async () => {
    const taskInsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingleContract = vi.fn().mockResolvedValue({ data: { id: "c1" }, error: null });
    const maybeSingleExisting = vi.fn().mockResolvedValue({ data: null, error: null });

    let contractTasksFromCalls = 0;
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "contracts") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: maybeSingleContract }),
              }),
            }),
          };
        }
        if (table === "contract_tasks") {
          contractTasksFromCalls += 1;
          if (contractTasksFromCalls === 1) {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    ilike: () => ({
                      limit: () => ({ maybeSingle: maybeSingleExisting }),
                    }),
                  }),
                }),
              }),
            };
          }
          return { insert: taskInsert };
        }
        throw new Error(table);
      }),
    } as never;

    const res = await executePostDecisionActions({
      admin,
      organizationId: "o",
      userId: "u",
      decisionWorkspaceId: "dec-ws",
      actions: [{ type: "create_task", contractId: "c1", title: "Do thing" }],
    });
    expect(res.tasksCreated).toBe(1);
    expect(res.errors).toHaveLength(0);
    expect(taskInsert).toHaveBeenCalled();
    expect(contractTasksFromCalls).toBe(2);
  });

  it("links exception when update succeeds", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "ex1" }, error: null });
    const admin = {
      from: vi.fn(() => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({ maybeSingle }),
            }),
          }),
        }),
      })),
    } as never;

    const res = await executePostDecisionActions({
      admin,
      organizationId: "o",
      userId: "u",
      decisionWorkspaceId: "d",
      actions: [{ type: "link_exception", exceptionId: "ex1" }],
    });
    expect(res.exceptionsLinked).toBe(1);
    expect(res.errors).toHaveLength(0);
  });

  it("rejects unknown action types", async () => {
    const admin = { from: vi.fn() } as never;
    const res = await executePostDecisionActions({
      admin,
      organizationId: "o",
      userId: "u",
      decisionWorkspaceId: "d",
      actions: [{ type: "nope" }],
    });
    expect(res.errors.some((e) => e.includes("Unknown"))).toBe(true);
  });
});
