import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_TELEMETRY_ACTIONS, type ProductTelemetryAction } from "./product-telemetry";

const ROOT = join(process.cwd(), "src");

const SKIP = new Set<string>([
  join(ROOT, "lib", "product-telemetry.ts"),
  join(ROOT, "lib", "product-telemetry.wiring.test.ts"),
  join(ROOT, "lib", "product-telemetry.details.test.ts"),
  join(ROOT, "lib", "product-telemetry-compatibility.test.ts"),
  join(ROOT, "lib", "telemetry-tier-c-paths.test.ts"),
]);

/** Emitted only via shared helpers; literals live in `product-telemetry.ts`. */
const HELPER_DYNAMIC: Set<ProductTelemetryAction> = new Set([
  "product.v9.work_action_attempted",
  "product.v9.work_action_succeeded",
  "product.v9.work_action_failed",
  "product.v9.visible_mutation_error",
]);

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !SKIP.has(p)) out.push(p);
  }
}

function hasEmitCall(body: string): boolean {
  return (
    body.includes("emitProductTelemetryEvent") ||
    body.includes("emitProductTelemetryIfFirstInOrganization") ||
    body.includes("emitProductTelemetryIfFirstForOrgUser") ||
    body.includes("emitWorkActionTelemetry") ||
    body.includes("emitVisibleMutationErrorTelemetry")
  );
}

describe("V9 telemetry Tier C — allowlisted actions co-locate with emit helpers", () => {
  it("each non-helper action appears in a module that calls an emit helper", () => {
    const files: string[] = [];
    walk(ROOT, files);
    const bodies = files.map((f) => ({ f, body: readFileSync(f, "utf8") }));

    for (const action of PRODUCT_TELEMETRY_ACTIONS) {
      if (action.startsWith("product.v10.")) continue;
      if (HELPER_DYNAMIC.has(action)) continue;
      const q = `"${action}"`;
      const hit = bodies.find((b) => b.body.includes(q) && hasEmitCall(b.body));
      expect(hit, `no emit helper near ${action}`).toBeDefined();
    }
  });

  it("work hub surfaces call emitWorkActionTelemetry (dynamic work_action_* strings)", () => {
    const hub = ["src/actions/tasks.ts", "src/actions/approvals.ts", "src/actions/obligations.ts"]
      .map((rel) => readFileSync(join(process.cwd(), rel), "utf8"))
      .join("\n");
    expect(hub).toContain("emitWorkActionTelemetry");
  });

  it("visible_mutation_error is emitted via emitVisibleMutationErrorTelemetry", () => {
    const hub = ["src/actions/tasks.ts", "src/actions/approvals.ts", "src/actions/obligations.ts"]
      .map((rel) => readFileSync(join(process.cwd(), rel), "utf8"))
      .join("\n");
    expect(hub).toContain("emitVisibleMutationErrorTelemetry");
  });
});
