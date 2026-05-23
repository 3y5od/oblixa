import { describe, expect, it } from "vitest";
import { buildWorkPageModel, CORE_WORK_ITEM_TYPES, normalizeWorkTab, WORK_TAB_ORDER } from "./model";
import { WORK_EMPTY_STATE, WORK_PAGE_TITLE, WORK_PRIMARY_CTA, WORK_ROW_LABELS } from "./spec-strings";
import type { BuildWorkPageModelInput, WorkReadModelRow } from "./model";

const userId = "user-1";

function baseInput(overrides: Partial<BuildWorkPageModelInput> = {}): BuildWorkPageModelInput {
  return {
    userId,
    role: "editor",
    workspaceMode: "core",
    rows: [],
    contracts: [
      { id: "contract-1", title: "Acme Corp MSA 2025" },
      { id: "contract-2", title: "Atlas DPA" },
    ],
    members: [
      { user_id: userId, profiles: { full_name: "Local Dev User", email: "local@example.test" } },
      { user_id: "user-2", profiles: { full_name: "Teammate", email: "teammate@example.test" } },
    ],
    ...overrides,
  };
}

function row(overrides: Partial<WorkReadModelRow>): WorkReadModelRow {
  return {
    id: "row-1",
    source_id: "source-1",
    source_table: "contract_tasks",
    type: "contract_task",
    title: "Review renewal owner",
    status: "open",
    contract_id: "contract-1",
    owner_user_id: userId,
    owner_state: "assigned",
    due_at: "2026-05-20",
    due_state: "due_soon",
    updated_at: "2026-05-17T10:00:00.000Z",
    ...overrides,
  };
}

describe("Work release-state model", () => {
  it("returns the release-state title, CTA, exact tabs, filters, and empty copy", () => {
    const model = buildWorkPageModel(baseInput());
    expect(model.title).toBe(WORK_PAGE_TITLE);
    expect(model.primaryCta).toBe(WORK_PRIMARY_CTA);
    expect(model.tabs.map((tab) => tab.key)).toEqual([...WORK_TAB_ORDER]);
    expect(model.filterOptions.dueDates.map((option) => option.label)).toContain("Due today");
    expect(WORK_EMPTY_STATE).toBe("Create work from a contract date, obligation, approval, or exception.");
  });

  it("maps legacy lens values to release-state tabs without rendering old lenses", () => {
    expect(normalizeWorkTab({ lens: "assigned" })).toBe("my_work");
    expect(normalizeWorkTab({ lens: "assigned_to_me" })).toBe("my_work");
    expect(normalizeWorkTab({ lens: "overdue" })).toBe("overdue");
    expect(normalizeWorkTab({ lens: "blocked" })).toBe("blocked");
    expect(normalizeWorkTab({ lens: "automation_approvals" })).toBe("approvals");
    expect(normalizeWorkTab({ lens: "failed_jobs" })).toBe("all");
  });

  it("includes only Core work item types from the V10 read model", () => {
    const model = buildWorkPageModel(
      baseInput({
        rows: [
          row({ id: "task", type: "contract_task" }),
          row({ id: "field", type: "field_review" }),
          row({ id: "failure", type: "import_failure" }),
          row({ id: "automation", type: "automation_approval" }),
        ],
      })
    );
    expect(model.rows.map((item) => item.type)).toEqual(["contract_task"]);
    expect(CORE_WORK_ITEM_TYPES).not.toContain("field_review");
  });

  it("applies tabs and filters to active visible work", () => {
    const model = buildWorkPageModel(
      baseInput({
        tab: "blocked",
        owner: userId,
        rows: [
          row({ id: "blocked", source_id: "blocked", status: "blocked", blocked_reason: "Waiting on legal" }),
          row({ id: "other", source_id: "other", status: "open", owner_user_id: "user-2" }),
        ],
      })
    );
    expect(model.activeTab).toBe("blocked");
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.blocker).toBe("Waiting on legal");
  });

  it("reveals terminal rows only through an explicit terminal status filter", () => {
    const withoutFilter = buildWorkPageModel(
      baseInput({
        rows: [row({ id: "done", source_id: "done", status: "done" })],
      })
    );
    const withFilter = buildWorkPageModel(
      baseInput({
        status: "done",
        rows: [row({ id: "done", source_id: "done", status: "done" })],
      })
    );
    expect(withoutFilter.rows).toHaveLength(0);
    expect(withFilter.rows).toHaveLength(1);
  });

  it("attaches contract and owner labels and exposes release-state actions", () => {
    const model = buildWorkPageModel(baseInput({ rows: [row({})] }));
    expect(model.rows[0]?.contractTitle).toBe("Acme Corp MSA 2025");
    expect(model.rows[0]?.ownerLabel).toBe("You");
    expect(model.rows[0]?.actions.map((action) => action.label)).toEqual([
      "Complete",
      "Reassign",
      "Change due date",
      "Comment",
      "Link evidence",
      "Escalate",
    ]);
  });

  it("groups row display fields into identity, ownership, and state sections", () => {
    const model = buildWorkPageModel(baseInput({ rows: [row({ blocked_reason: "Waiting on finance" })] }));
    const display = model.rows[0]?.display;

    expect(display?.identity.title).toMatchObject({
      label: WORK_ROW_LABELS.title,
      value: "Review renewal owner",
    });
    expect(display?.identity.linkedContract).toMatchObject({
      label: WORK_ROW_LABELS.linkedContract,
      value: "Acme Corp MSA 2025",
      href: "/contracts/contract-1",
    });
    expect(display?.ownership.owner).toMatchObject({ label: WORK_ROW_LABELS.owner, value: "You" });
    expect(display?.ownership.dueDate.label).toBe(WORK_ROW_LABELS.dueDate);
    expect(display?.ownership.lastUpdate.label).toBe(WORK_ROW_LABELS.lastUpdate);
    expect(display?.state.status).toMatchObject({ label: WORK_ROW_LABELS.status, value: "Open" });
    expect(display?.state.type).toMatchObject({ label: WORK_ROW_LABELS.type, value: "Task" });
    expect(display?.state.blocker).toMatchObject({
      label: WORK_ROW_LABELS.blocker,
      value: "Waiting on finance",
    });
  });
});
