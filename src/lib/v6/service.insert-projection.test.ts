import { describe, expect, it } from "vitest";
import { insertReturnColumnsForTable } from "./service";

describe("insertReturnColumnsForTable", () => {
  it("narrows known v6 tables", () => {
    expect(insertReturnColumnsForTable("assurance_findings")).toContain("updated_at");
    expect(insertReturnColumnsForTable("assurance_check_runs")).not.toContain("updated_at");
    expect(insertReturnColumnsForTable("operational_recommendations")).toContain("generated_at");
  });

  it("falls back to star for unknown tables", () => {
    expect(insertReturnColumnsForTable("unknown_table_xyz")).toBe("*");
  });
});
