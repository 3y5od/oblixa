import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SENTRY_TS = join(process.cwd(), "src/lib/observability/sentry.ts");

describe("addProductSurfaceDiagnosticBreadcrumb (V7 §21.2)", () => {
  it("only forwards family, reason, and discoverability into Sentry breadcrumb data", () => {
    const raw = readFileSync(SENTRY_TS, "utf8");
    expect(raw).toContain("addProductSurfaceDiagnosticBreadcrumb");
    expect(raw).toContain("typeof family === \"string\"");
    expect(raw).toContain("typeof reason === \"string\"");
    expect(raw).toContain("typeof discoverability === \"string\"");
    expect(raw).not.toMatch(/data:\s*\{[\s\S]*?apiPath/);
    expect(raw).not.toMatch(/data:\s*\{[\s\S]*?\.\.\.details/);
  });
});
