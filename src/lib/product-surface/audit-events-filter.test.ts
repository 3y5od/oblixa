import { describe, expect, it } from "vitest";
import { filterAuditEventsForWorkspaceMode } from "@/lib/product-surface/audit-events-filter";

describe("filterAuditEventsForWorkspaceMode", () => {
  it("passes through when not core", () => {
    const rows = [{ action: "campaign.created", id: "1" }];
    expect(filterAuditEventsForWorkspaceMode(rows, "advanced")).toEqual(rows);
  });

  it("strips advanced/assurance-ish actions in core", () => {
    const rows = [
      { action: "approval.requested", id: "a" },
      { action: "campaign.started", id: "b" },
      { action: "assurance.check_run", id: "c" },
      { action: "finding.opened", id: "d" },
    ];
    const out = filterAuditEventsForWorkspaceMode(rows, "core");
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });
});
