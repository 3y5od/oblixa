import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/work/page.tsx");
const WORK_QUEUE_SURFACE = join(process.cwd(), "src/app/(dashboard)/work/work-queue-surface.tsx");
const WORK_TABLE = join(process.cwd(), "src/app/(dashboard)/work/work-table.tsx");

function readWorkSurfaceSource() {
  return [PAGE, WORK_QUEUE_SURFACE, WORK_TABLE].map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("work page surface", () => {
  it("keeps the task queue summary compact — condition definitions ride on the chips, not a prose wall", () => {
    const raw = readWorkSurfaceSource();

    expect(raw).toContain("Active tasks");
    expect(raw).toContain("Condition filters");
    // Each definition lives on its chip (tooltip + aria-label), not a wall.
    expect(raw).toContain("Answer, approval, file, or owner is missing.");
    expect(raw).toContain("Due date has passed.");
    expect(raw).toContain("Due today or within the next 7 days.");
    expect(raw).toContain("No owner is assigned.");
    expect(raw).toContain("No condition filters need attention.");
    // Tabs explanation retained.
    expect(raw).toContain("Views");
    expect(raw).toContain("Task table views");
    expect(raw).toContain("Choose the row category shown below. Counts reflect the active filters.");
    // The old prose definition wall + lead paragraph are gone (decluttered to match Contracts).
    expect(raw).not.toContain("Active tasks are open follow-up items linked to signed contracts.");
    expect(raw).not.toContain("Condition filters show matching task");
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
