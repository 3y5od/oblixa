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
    expect(WORK_EMPTY_STATE).toBe("Create a task for a contract date, requirement, approval, problem, or evidence request.");
  });

  it("maps legacy lens values to release-state tabs without rendering old lenses", () => {
    expect(normalizeWorkTab({ lens: "assigned" })).toBe("my_work");
    expect(normalizeWorkTab({ lens: "assigned_to_me" })).toBe("my_work");
    expect(normalizeWorkTab({ lens: "overdue" })).toBe("overdue");
    expect(normalizeWorkTab({ lens: "blocked" })).toBe("blocked");
    expect(normalizeWorkTab({ lens: "automation_approvals" })).toBe("approvals");
    expect(normalizeWorkTab({ lens: "failed_jobs" })).toBe("all");
  });

  it("includes only Core task item types from the read model", () => {
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

  it("cleans up internal task titles for display", () => {
    const model = buildWorkPageModel(
      baseInput({
        rows: [
          row({
            id: "review",
            source_id: "review",
            title: "Approve extracted fields for BluePeak Adjusting",
          }),
          row({
            id: "hold",
            source_id: "hold",
            title: "Resolve Ridgeway price hold blocker",
          }),
        ],
      })
    );

    expect(model.rows.map((item) => item.title)).toEqual([
      "Review contract details for BluePeak Adjusting",
      "Resolve Ridgeway price hold",
    ]);
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
    expect(display?.state.status).toMatchObject({ label: WORK_ROW_LABELS.status, value: "To do" });
    expect(display?.state.type).toMatchObject({ label: WORK_ROW_LABELS.type, value: "Task" });
    expect(display?.state.blocker).toMatchObject({
      label: WORK_ROW_LABELS.blocker,
      value: "Waiting on finance",
    });
  });

  it("derives a status- and type-aware primary action verb for each row", () => {
    const now = new Date("2026-05-30T00:00:00.000Z");
    const model = buildWorkPageModel(
      baseInput({
        now,
        rows: [
          row({ id: "task", source_id: "task", type: "contract_task", status: "open", due_at: "2026-06-15" }),
          row({ id: "appr", source_id: "appr", type: "approval", status: "open", due_at: "2026-06-15" }),
          row({ id: "exc", source_id: "exc", type: "exception", status: "open", due_at: "2026-06-15" }),
          row({ id: "evd", source_id: "evd", type: "evidence_request", status: "open", due_at: "2026-06-15" }),
          row({
            id: "una",
            source_id: "una",
            type: "unassigned_work",
            status: "open",
            owner_user_id: null,
            owner_state: "unassigned",
            due_at: "2026-06-15",
          }),
          row({
            id: "blk",
            source_id: "blk",
            type: "contract_task",
            status: "blocked",
            blocked_reason: "Waiting on finance",
            due_at: null,
          }),
        ],
      })
    );
    const primaryBySource = new Map(model.rows.map((item) => [item.sourceId, item.primaryAction]));
    expect(primaryBySource.get("task")).toMatchObject({ verb: "complete", kind: "mutation" });
    expect(primaryBySource.get("appr")?.verb).toBe("approve");
    expect(primaryBySource.get("exc")?.verb).toBe("resolve");
    expect(primaryBySource.get("evd")?.verb).toBe("attach");
    expect(primaryBySource.get("una")?.verb).toBe("assign");
    // Blocked work can't be completed — it routes to review, never a mutation.
    expect(primaryBySource.get("blk")).toMatchObject({ verb: "review", kind: "link" });
  });

  it("summarizes blocked, overdue, due-soon, and unassigned counts over the filtered set", () => {
    const now = new Date("2026-05-30T00:00:00.000Z");
    const model = buildWorkPageModel(
      baseInput({
        now,
        rows: [
          row({ id: "blk", source_id: "blk", status: "blocked", blocked_reason: "X", due_at: null }),
          row({ id: "ovr", source_id: "ovr", status: "open", due_at: "2026-05-20" }),
          row({ id: "soon", source_id: "soon", status: "open", due_at: "2026-06-02" }),
          row({
            id: "una",
            source_id: "una",
            status: "open",
            owner_user_id: null,
            owner_state: "unassigned",
            due_at: null,
          }),
        ],
      })
    );
    expect(model.summary).toEqual({ blocked: 1, overdue: 1, dueSoon: 1, unassigned: 1 });
  });

  it("paginates the active tab to the page size and clamps out-of-range pages", () => {
    const now = new Date("2026-05-30T00:00:00.000Z");
    const rows = Array.from({ length: 30 }, (_, index) =>
      row({ id: `r${index}`, source_id: `r${index}`, status: "open", due_at: "2026-06-15" })
    );

    const page1 = buildWorkPageModel(baseInput({ now, rows }));
    expect(page1.pagination).toMatchObject({ page: 1, pageSize: 25, total: 30, totalPages: 2 });
    expect(page1.rows).toHaveLength(25);
    // Tab counts stay full (over the whole filtered set), not the page slice.
    expect(page1.tabs.find((tab) => tab.key === "all")?.count).toBe(30);

    const page2 = buildWorkPageModel(baseInput({ now, rows, page: "2" }));
    expect(page2.pagination.page).toBe(2);
    expect(page2.rows).toHaveLength(5);

    // Out-of-range page clamps to the last page rather than rendering nothing.
    expect(buildWorkPageModel(baseInput({ now, rows, page: "99" })).pagination.page).toBe(2);
  });

  it("sorts the active tab by the requested key and falls back to urgency", () => {
    const now = new Date("2026-05-30T00:00:00.000Z");
    const rows = [
      row({ id: "a", source_id: "a", due_at: "2026-06-20", updated_at: "2026-05-28T00:00:00.000Z" }),
      row({ id: "b", source_id: "b", due_at: "2026-06-05", updated_at: "2026-05-10T00:00:00.000Z" }),
      row({ id: "c", source_id: "c", due_at: "2026-06-15", updated_at: "2026-05-20T00:00:00.000Z" }),
    ];

    const byDue = buildWorkPageModel(baseInput({ now, rows, sort: "due" }));
    expect(byDue.sort).toBe("due");
    expect(byDue.rows.map((item) => item.sourceId)).toEqual(["b", "c", "a"]);

    const byUpdated = buildWorkPageModel(baseInput({ now, rows, sort: "updated" }));
    expect(byUpdated.rows.map((item) => item.sourceId)).toEqual(["a", "c", "b"]);

    // An unknown sort value falls back to the urgency default.
    expect(buildWorkPageModel(baseInput({ now, rows, sort: "bogus" })).sort).toBe("urgency");
  });
});
