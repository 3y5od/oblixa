import { describe, expect, it } from "vitest";
import { combineContractListIntersectIds, getContractIdsWithV10HealthWatch } from "./contract-list-id-filters";

describe("contract list id filters (V10)", () => {
  it("keeps dashboard deep-link filters composable with contract-list intersections", () => {
    expect(combineContractListIntersectIds([["contract_1", "contract_2"], ["contract_2"]])).toEqual([
      "contract_2",
    ]);
    expect(combineContractListIntersectIds([["contract_1"], []])).toEqual([]);
    expect(combineContractListIntersectIds([null, ["contract_1"]])).toEqual(["contract_1"]);
  });

  it("routes V10 health filters through shared visibility constraints", async () => {
    const calls: Array<{ method: string; column: string; value: unknown }> = [];
    const query = {
      eq(column: string, value: unknown) {
        calls.push({ method: "eq", column, value });
        return query;
      },
      in(column: string, value: unknown) {
        calls.push({ method: "in", column, value });
        return query;
      },
      lt(column: string, value: unknown) {
        calls.push({ method: "lt", column, value });
        return query;
      },
      not(column: string, operator: string, value: unknown) {
        calls.push({ method: "not", column, value: `${operator}:${String(value)}` });
        return Promise.resolve({ data: [{ contract_id: "contract_1" }, { contract_id: "contract_1" }], error: null });
      },
    };
    const admin = {
      from(table: string) {
        calls.push({ method: "from", column: "table", value: table });
        return {
          select(column: string) {
            calls.push({ method: "select", column, value: column });
            return query;
          },
        };
      },
    };

    await expect(getContractIdsWithV10HealthWatch(admin as never, "org_1", { role: "viewer", workspaceMode: "core" })).resolves.toEqual([
      "contract_1",
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: "eq", column: "organization_id", value: "org_1" },
        { method: "eq", column: "visibility_state", value: "visible" },
        { method: "in", column: "required_role_minimum", value: ["viewer"] },
        { method: "in", column: "workspace_mode", value: ["core"] },
        { method: "lt", column: "score", value: 85 },
      ])
    );
  });
});
