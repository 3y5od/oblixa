import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/reports/page.tsx");

describe("reports control room reliability messaging (V9)", () => {
  it("surfaces recent report run posture and links to health diagnostics on the core reports page", () => {
    const raw = readFileSync(PAGE, "utf8");
    expect(raw).toContain("reports_control_room_snapshot");
    expect(raw).toContain("buildReportsControlRoomSummary");
    expect(raw).toContain("Report delivery posture");
    expect(raw).toContain("Latest export follow-through");
    expect(raw).toContain('href="/settings/health"');
    expect(raw).toContain("Open report history");
    expect(raw).toContain("Report generation in progress");
    expect(raw).toContain("Report generation failed");
    expect(raw).toContain('data-v9-anchor="export-follow-through-state"');
    expect(raw).toContain('data-v9-anchor="report-generation-in-progress"');
    expect(raw).toContain('data-v9-anchor="report-generation-failed"');
  });
});
