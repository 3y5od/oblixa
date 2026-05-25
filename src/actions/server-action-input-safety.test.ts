import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actionsRoot = join(process.cwd(), "src/actions");

function readAction(name: string) {
  return readFileSync(join(actionsRoot, name), "utf8");
}

function readActionTest(name: string) {
  return readFileSync(join(actionsRoot, name), "utf8");
}

describe("server action input safety coverage", () => {
  it("covers malformed id rejection before sensitive action writes", () => {
    const coverage = [
      readActionTest("contracts-action-scope.test.ts"),
      readActionTest("tasks.test.ts"),
      readActionTest("approvals.test.ts"),
      readActionTest("settings-action-scope.test.ts"),
    ].join("\n");

    expect(coverage).toContain("bad-id");
    expect(coverage).toContain("not-a-uuid");
    expect(coverage).toContain("Invalid contract");
    expect(coverage).toContain("Invalid organization");
    expect(readAction("tasks.ts")).toContain("isUuid");
    expect(readAction("contracts.ts")).toContain("isUuid");
  });

  it("covers invalid form state parsing for JSON-backed server actions", () => {
    const policyOperationsSource = readAction("policy-operations.ts");
    const productSettingsSource = readAction("product-surface-settings.ts");

    expect(policyOperationsSource).toContain("Invalid JSON");
    expect(policyOperationsSource).toContain("overrideJson must be valid JSON");
    expect(policyOperationsSource).toContain("workspaceJson must be valid JSON");
    expect(productSettingsSource).toContain("isValidDefaultLandingPath");
    expect(productSettingsSource).toContain("That default landing path is not available");
  });

  it("covers stale optimistic update handling for versioned work-item actions", () => {
    const tasksSource = readAction("tasks.ts");
    const v10ContractTest = readFileSync(join(process.cwd(), "src/lib/server-contracts.test.ts"), "utf8");

    expect(tasksSource).toContain("expectedVersion: input.expectedVersion");
    expect(tasksSource).toContain("currentVersion: task.updated_at");
    expect(v10ContractTest).toContain("stale_version");
    expect(v10ContractTest).toContain("expectedVersion: \"version_1\"");
    expect(v10ContractTest).toContain("currentVersion: \"version_2\"");
  });
});
