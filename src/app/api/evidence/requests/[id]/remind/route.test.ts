import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  join(process.cwd(), "src/app/api/evidence/requests/[id]/remind/route.ts"),
  "utf8"
);

describe("/api/evidence/requests/[id]/remind route contract", () => {
  it("rejects unsafe params and requires authenticated contract-edit capability", () => {
    expect(SRC).toContain("rejectUnsafeRouteParams");
    expect(SRC).toContain("getApiAuthContext");
    expect(SRC).toContain('canManageCapability(ctx, "contracts_edit")');
  });

  it("keeps reminder mutations scoped to the caller organization", () => {
    expect(SRC).toContain('eq("organization_id", ctx.orgId)');
    expect(SRC).toContain("requireApiWorkspaceEligibility");
    expect(SRC).toContain("MutationResponse: true");
  });

  it("records audit, telemetry, and read-model refresh evidence", () => {
    expect(SRC).toContain("recordV10AuditEvent");
    expect(SRC).toContain("emitProductTelemetryEvent");
    expect(SRC).toContain("refreshV10ReadModelsForOrganization");
  });
});
