import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_TELEMETRY_ACTIONS, type ProductTelemetryAction } from "./product-telemetry";

const ROOT = join(process.cwd(), "src");

const SKIP_FILES = new Set<string>([
  join(ROOT, "lib", "product-telemetry.ts"),
  join(ROOT, "lib", "product-telemetry.wiring.test.ts"),
]);

/** Emitted only via shared helpers whose string literals live in `product-telemetry.ts`. */
const HELPER_EMITTED_ACTIONS = new Set<ProductTelemetryAction>([
  "product.v9.work_action_attempted",
  "product.v9.work_action_succeeded",
  "product.v9.work_action_failed",
  "product.v9.visible_mutation_error",
]);

function walk(dir: string, out: string[]) {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !SKIP_FILES.has(p)) out.push(p);
  }
}

describe("product telemetry wiring (§28 allowlist)", () => {
  it("each allowlisted action string appears outside lib/product-telemetry.ts", () => {
    const files: string[] = [];
    walk(ROOT, files);
    const corpus = files
      .filter((f) => statSync(f, { throwIfNoEntry: false })?.isFile())
      .map((f) => `${f}\0${readFileSync(f, "utf8")}`)
      .join("\n");

    const coreLib = readFileSync(join(process.cwd(), "src", "lib", "product-telemetry.ts"), "utf8");
    const helperConsumers = [
      readFileSync(join(process.cwd(), "src", "actions", "tasks.ts"), "utf8"),
      readFileSync(join(process.cwd(), "src", "actions", "approvals.ts"), "utf8"),
      readFileSync(join(process.cwd(), "src", "actions", "obligations.ts"), "utf8"),
      readFileSync(join(process.cwd(), "src", "actions", "contracts.ts"), "utf8"),
      readFileSync(join(process.cwd(), "src", "actions", "exceptions.ts"), "utf8"),
    ].join("\n");

    for (const action of PRODUCT_TELEMETRY_ACTIONS) {
      if (HELPER_EMITTED_ACTIONS.has(action)) {
        expect(coreLib, action).toContain(`"${action}"`);
        if (action === "product.v9.visible_mutation_error") {
          expect(helperConsumers).toContain("emitVisibleMutationErrorTelemetry");
        } else {
          expect(helperConsumers).toContain("emitWorkActionTelemetry");
        }
        continue;
      }
      expect(corpus, action).toContain(`"${action}"`);
    }
  });
});
