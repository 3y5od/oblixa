import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/settings/health/page.tsx");

describe("settings health visible impact and report posture (V9)", () => {
  it("surfaces user-visible impact rows and recent report reliability summaries", () => {
    const raw = readFileSync(PAGE, "utf8");
    expect(raw).toContain("What workspace users may notice");
    expect(raw).toContain("Workflow reliability visibility");
    expect(raw).toContain("Reminder and digest emails may arrive late");
    expect(raw).toContain("Open import history");
    expect(raw).toContain("Open contract exports");
    expect(raw).toContain("Open review and extraction follow-up");
    expect(raw).toContain("Report run reliability");
    expect(raw).toContain("Latest successful digest");
    expect(raw).toContain("Latest failed digest");
  });
});
