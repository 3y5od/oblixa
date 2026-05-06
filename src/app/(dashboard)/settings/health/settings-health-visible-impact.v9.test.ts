import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/settings/health/page.tsx");
const DIAGNOSTICS = join(
  process.cwd(),
  "src/app/(dashboard)/settings/health/settings-health-diagnostics-sections.tsx"
);

describe("settings health visible impact and report posture (V9)", () => {
  it("surfaces user-visible impact rows and recent report reliability summaries", () => {
    const raw = [readFileSync(PAGE, "utf8"), readFileSync(DIAGNOSTICS, "utf8")].join("\n");
    expect(raw).toContain("What workspace users may notice");
    expect(raw).toContain("Workflow reliability visibility");
    expect(raw).toContain("Reminder and digest emails may arrive late");
    expect(raw).toContain("Review import history");
    expect(raw).toContain("Review contract exports");
    expect(raw).toContain("Review extraction follow-up");
    expect(raw).toContain("Report run reliability");
    expect(raw).toContain("Latest successful digest");
    expect(raw).toContain("Latest failed digest");
  });
});
