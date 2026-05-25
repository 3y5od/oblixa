import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectTsxFiles(dir: string, out: string[]): void {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) collectTsxFiles(p, out);
    else if (ent.name.endsWith(".tsx")) out.push(p);
  }
}

/**
 * §21.3 — When optimistic UI is absent, mutations must still surface server rejection
 * (recoverable copy + non-silent rollback is trivial because no speculative local state).
 */
describe("V9 optimistic mutation inventory", () => {
  it("does not use React useOptimistic anywhere under src (no speculative row state to roll back)", () => {
    const files: string[] = [];
    collectTsxFiles(join(process.cwd(), "src"), files);
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("useOptimistic"));
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("work inline actions keep mutation feedback on the server response path", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/work/work-queue-inline-actions.tsx"),
      "utf8"
    );
    expect(raw).toContain("startTransition");
    expect(raw).toContain("describeRecoverableMutationError");
    expect(raw).toContain('role={messageTone === "success" ? "status" : "alert"}');
  });
});
