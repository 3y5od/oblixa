import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §23 performance — page load instrumentation anchor", () => {
  it("page-load reporter lists measured route prefixes for core paths", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/layout/page-load-reporter.tsx"),
      "utf8"
    );
    expect(raw).toContain("MEASURED_PREFIXES");
    expect(raw).toMatch(/\/dashboard|\/contracts|\/work/);
    expect(raw).toMatch(/\/settings|\/decisions|\/assurance/);
    expect(raw).toMatch(/\/relationship-workspaces|\/accounts|\/counterparties/);
  });

  it("product telemetry action module still wires page_load_measured emission", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/product-telemetry.ts"), "utf8");
    expect(raw).toContain("page_load_measured");
  });
});
