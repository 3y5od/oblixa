import { describe, expect, it, vi } from "vitest";
import { runTaskAutomationRulesForOrg } from "./run-task-automation-rules-for-org";

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/integrations/slack", () => ({
  sendSlackWorkflowNotification: vi.fn(async () => undefined),
}));

type QueryResult = { data: any; error: { message: string; code?: string } | null };

function createAwaitableChain(result: QueryResult) {
  const normalized = { data: result.data ?? null, error: result.error ?? null };
  const chain: any = {
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    not: () => chain,
    contains: () => chain,
    gte: () => chain,
    lt: () => chain,
    maybeSingle: async () => normalized,
    single: async () => normalized,
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(normalized).then(resolve, reject),
  };
  return chain;
}

function createInsertChain(result: QueryResult) {
  return {
    select: () => ({ single: async () => ({ data: result.data ?? null, error: result.error ?? null }) }),
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject),
  };
}

function createAdminMock(input: {
  select: Record<string, QueryResult[]>;
  insert?: Record<string, QueryResult[]>;
}) {
  return {
    from(table: string) {
      return {
        select() {
          const next = input.select[table]?.shift() ?? { data: null, error: null };
          return createAwaitableChain(next);
        },
        insert() {
          const next = input.insert?.[table]?.shift() ?? { data: null, error: null };
          return createInsertChain(next);
        },
      };
    },
  };
}

describe("runTaskAutomationRulesForOrg", () => {
  it("surfaces source query failures instead of treating them as empty data", async () => {
    const admin = createAdminMock({
      select: {
        task_automation_rules: [
          {
            data: [
              {
                id: "rule-1",
                name: "Missing owner",
                trigger_type: "field_missing",
                config_json: { requiredField: "owner" },
              },
            ],
            error: null,
          },
        ],
        contracts: [{ data: null, error: { message: "contracts lookup failed" } }],
      },
    });

    const result = await runTaskAutomationRulesForOrg(admin as never, "org-1");

    expect(result).toMatchObject({ generated: 0, evaluatedRules: 1 });
    expect(result.errors).toEqual([
      expect.objectContaining({
        diagnostic_id: "task_rule_field_missing_contract_query_failed",
        phase: "source_query",
        message: "contracts lookup failed",
      }),
    ]);
  });

  it("treats unique-constraint collisions as duplicate work instead of failures", async () => {
    const admin = createAdminMock({
      select: {
        task_automation_rules: [
          {
            data: [
              {
                id: "rule-1",
                name: "At risk",
                trigger_type: "risk_threshold",
                config_json: { taskTitle: "Follow up" },
              },
            ],
            error: null,
          },
        ],
        contracts: [{ data: [{ id: "contract-1", health_status: "at_risk" }], error: null }],
        contract_tasks: [{ data: null, error: null }],
      },
      insert: {
        contract_tasks: [{ data: null, error: { code: "23505", message: "duplicate key value" } }],
      },
    });

    const result = await runTaskAutomationRulesForOrg(admin as never, "org-1");

    expect(result).toMatchObject({ generated: 0, evaluatedRules: 1 });
    expect(result.errors).toEqual([]);
  });

  it("treats report queue unique-constraint collisions as duplicate work instead of failures", async () => {
    const admin = createAdminMock({
      select: {
        task_automation_rules: [
          {
            data: [
              {
                id: "rule-1",
                name: "Queue report",
                trigger_type: "risk_threshold",
                config_json: { actionType: "trigger_report", reportMode: "management" },
              },
            ],
            error: null,
          },
        ],
        contracts: [{ data: [{ id: "contract-1", health_status: "at_risk" }], error: null }],
      },
      insert: {
        report_runs: [{ data: null, error: { code: "23505", message: "duplicate key value" } }],
      },
    });

    const result = await runTaskAutomationRulesForOrg(admin as never, "org-1");

    expect(result).toMatchObject({ generated: 0, evaluatedRules: 1 });
    expect(result.errors).toEqual([]);
  });
});