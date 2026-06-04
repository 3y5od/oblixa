import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageRaw = readFileSync(
  join(process.cwd(), "src/app/(dashboard)/contracts/imports/[jobId]/page.tsx"),
  "utf8"
);

describe("import job details page", () => {
  it("renders an operational, Core-safe job summary", () => {
    for (const copy of [
      'eyebrow="Contract import"',
      "Rows in file",
      "Created",
      "Need correction",
      "Rows that need correction",
      "Back to import",
    ]) {
      expect(pageRaw).toContain(copy);
    }
  });

  it("scopes reads to the workspace and never exposes import internals", () => {
    // Reads are workspace-scoped.
    expect(pageRaw).toContain('.eq("organization_id", ctx.orgId)');
    // Core-safe: no raw row payloads, provider/internal diagnostics, scheduler
    // state, or stack traces are selected or rendered on this surface.
    for (const forbidden of [
      "raw_payload",
      "failure_category",
      "diagnostic_id",
      "scheduler",
      "stack",
      "provider_",
    ]) {
      expect(pageRaw).not.toContain(forbidden);
    }
  });
});
