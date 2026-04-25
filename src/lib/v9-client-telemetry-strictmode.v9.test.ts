import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 client telemetry StrictMode / churn guards", () => {
  it("page-load reporter debounces duplicate path emits within a time window", () => {
    const body = readFileSync(
      join(process.cwd(), "src/components/layout/v9-page-load-reporter.tsx"),
      "utf8"
    );
    expect(body).toContain("8000");
    expect(body).toContain("StrictMode");
  });

  it("uses nested requestAnimationFrame before telemetry so paint milestones are not doubled as StrictMode effects", () => {
    const body = readFileSync(
      join(process.cwd(), "src/components/layout/v9-page-load-reporter.tsx"),
      "utf8"
    );
    expect(body).toContain("requestAnimationFrame");
    expect(body).toMatch(/requestAnimationFrame\([\s\S]*requestAnimationFrame/);
  });
});
