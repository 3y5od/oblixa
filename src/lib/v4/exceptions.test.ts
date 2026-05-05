import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExceptionFingerprint } from "@/lib/v4/exceptions";

const appendCasefileEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/v4/casefile", () => ({
  appendCasefileEvent,
}));

describe("buildExceptionFingerprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes segments and joins with colon", () => {
    const fp = buildExceptionFingerprint({
      organizationId: "ORG-1",
      contractId: "cid",
      linkedEntityType: null,
      linkedEntityId: null,
      exceptionType: "SLA Miss",
    });
    expect(fp).toContain("org-1");
    expect(fp).toContain("slamiss");
    expect(fp.split(":")).toHaveLength(4);
  });

  it("uses linked entity when present", () => {
    const a = buildExceptionFingerprint({
      organizationId: "o",
      contractId: "c",
      linkedEntityType: "task",
      linkedEntityId: "t1",
      exceptionType: "x",
    });
    expect(a).toContain("task");
    expect(a).toContain("t1");
  });

  it("falls back to insert-then-update when a duplicate fingerprint already exists", async () => {
    const insertedEvents: unknown[] = [];
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "exceptions") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: { code: "23505", message: "duplicate key value violates unique constraint" },
                })),
              })),
            })),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { id: "exc-1", organization_id: "org-1", contract_id: "contract-1" },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }

        if (table === "exception_events") {
          return {
            insert: vi.fn(async (rows: unknown[]) => {
              insertedEvents.push(...rows);
              return { error: null };
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const { upsertDetectedExceptions } = await import("@/lib/v4/exceptions");
    const result = await upsertDetectedExceptions({
      admin: admin as never,
      detector: "cron:test",
      rows: [
        {
          organizationId: "org-1",
          contractId: "contract-1",
          linkedEntityType: "task",
          linkedEntityId: "task-1",
          exceptionType: "overdue_task",
          title: "Overdue task",
          details: "Task is overdue",
          severity: "high",
        },
      ],
    });

    expect(result).toEqual({ touched: 1 });
    expect(insertedEvents).toHaveLength(1);
    expect(appendCasefileEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        contractId: "contract-1",
        entityId: "exc-1",
      })
    );
  });
});
