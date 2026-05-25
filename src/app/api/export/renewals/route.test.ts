import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/app/api/export/renewals/route.ts"), "utf8");

describe("/api/export/renewals route contract", () => {
  it("requires session auth and workspace eligibility before export generation", () => {
    expect(SRC).toContain("supabase.auth.getUser()");
    expect(SRC).toContain("getDeterministicMembership");
    expect(SRC).toContain("requireApiWorkspaceEligibility");
  });

  it("rate limits CSV export requests", () => {
    expect(SRC).toContain("rateLimitCheck");
    expect(SRC).toContain("export-renewals:${user.id}:${ip}");
    expect(SRC).toContain("jsonRateLimited");
  });

  it("emits telemetry and returns a safe attachment response", () => {
    expect(SRC).toContain("emitProductTelemetryEvent");
    expect(SRC).toContain("sanitizeExportFileName");
    expect(SRC).toContain("contentDispositionAttachment");
    expect(SRC).toContain('"Cache-Control": "private, no-store"');
  });
});
