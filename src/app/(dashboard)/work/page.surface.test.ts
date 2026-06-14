import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/work/page.tsx");
const WORK_TABLE = join(process.cwd(), "src/app/(dashboard)/work/work-table.tsx");

function readWorkSurfaceSource() {
  return [PAGE, WORK_TABLE].map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("work page surface", () => {
  it("keeps the task queue summary compact while clarifying count semantics", () => {
    const raw = readWorkSurfaceSource();

    expect(raw).toContain("Active tasks");
    expect(raw).toContain("Active tasks are open follow-up items linked to signed contracts.");
    expect(raw).toContain("Condition filters show matching task");
    expect(raw).toContain("Condition filters");
    expect(raw).toContain("Cannot proceed");
    expect(raw).toContain("answer,");
    expect(raw).toContain("approval, file, or owner is missing.");
    expect(raw).toContain("Past due");
    expect(raw).toContain("due date has");
    expect(raw).toContain("Due within 7 days");
    expect(raw).toContain("today or this week.");
    expect(raw).toContain("Unassigned");
    expect(raw).toContain("Views");
    expect(raw).toContain("Task table views");
    expect(raw).toContain("Choose the row category shown below. Counts reflect the active filters.");
    expect(raw).toContain("No condition filters need attention.");
  });

  it("constrains the nested page stack on narrow viewports", () => {
    const raw = readWorkSurfaceSource();

    expect(raw).toContain(
      'className="ui-page-stack mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip"'
    );
    expect(raw).toContain(
      'className="ui-table-shell min-w-0 max-w-full [contain:inline-size]"'
    );
    expect(raw).toContain(
      'className="hidden max-h-[calc(100dvh-20rem)] min-w-0 max-w-full overflow-x-auto overflow-y-auto [contain:inline-size] md:block"'
    );
  });
});
