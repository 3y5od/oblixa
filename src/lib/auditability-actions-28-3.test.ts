import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[]): void {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
}

describe("V9 §28.3 auditability (audit_events inserts on mutations)", () => {
  it("keeps a breadth of server actions writing audit_events", () => {
    const files: string[] = [];
    walk(join(process.cwd(), "src", "actions"), files);
    const audited = files.filter((f) => readFileSync(f, "utf8").includes('.from("audit_events")'));
    expect(audited.length).toBeGreaterThanOrEqual(10);
    expect(audited.some((f) => f.includes("onboarding-calibration"))).toBe(true);
    expect(audited.some((f) => f.endsWith("/contracts.ts"))).toBe(true);
    expect(audited.some((f) => f.includes("settings"))).toBe(true);
    expect(audited.some((f) => f.endsWith("/exceptions.ts"))).toBe(true);
  });

  it("onboarding calibration path still performs audit inserts (calibration anchor)", () => {
    const p = join(process.cwd(), "src", "actions", "onboarding-calibration.ts");
    expect(statSync(p).isFile()).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src).toContain('.from("audit_events")');
  });
});
