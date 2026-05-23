import { describe, expect, it } from "vitest";
import {
  buildRenewalsPageModel,
  normalizeRenewalWindow,
  type RenewalCheckpointRow,
  type RenewalContractRow,
  type RenewalFieldRow,
  type RenewalWorkItemRow,
} from "@/lib/renewals/model";
import { RENEWALS_EMPTY_STATE } from "@/lib/renewals/spec-strings";
import type { OrgMemberProfileRow } from "@/lib/org-member-profiles";

const NOW = new Date("2026-05-18T12:00:00Z");
const members: OrgMemberProfileRow[] = [
  {
    user_id: "u1",
    profiles: { full_name: "Local Dev User", email: "local@example.com" },
  },
];

function contract(overrides: Partial<RenewalContractRow> = {}): RenewalContractRow {
  return {
    id: "c1",
    title: "Atlas Agreement",
    counterparty: "Atlas Cloud Systems",
    status: "active",
    owner_id: "u1",
    updated_at: "2026-05-17T10:00:00Z",
    ...overrides,
  };
}

function field(
  contractId: string,
  fieldName: string,
  value: string,
  status = "approved"
): RenewalFieldRow {
  return {
    contract_id: contractId,
    field_name: fieldName,
    field_value: value,
    status,
    updated_at: "2026-05-17T10:00:00Z",
  };
}

function build(input: {
  contracts?: RenewalContractRow[];
  fields?: RenewalFieldRow[];
  checkpoints?: RenewalCheckpointRow[];
  workItems?: RenewalWorkItemRow[];
  owner?: string;
  counterparty?: string;
  status?: string;
  window?: string;
  horizon?: string;
  warnings?: string[];
}) {
  return buildRenewalsPageModel({
    userId: "u1",
    role: "admin",
    workspaceMode: "core",
    window: input.window,
    horizon: input.horizon,
    owner: input.owner,
    counterparty: input.counterparty,
    status: input.status,
    contracts: input.contracts ?? [],
    fields: input.fields ?? [],
    checkpoints: input.checkpoints ?? [],
    workItems: input.workItems ?? [],
    members,
    warnings: input.warnings,
    now: NOW,
  });
}

describe("renewals page model", () => {
  it("returns a usable empty workspace model", () => {
    const model = build({});
    expect(model.title).toBe("Renewals");
    expect(model.primaryCta).toBe("Create renewal task");
    expect(model.rows).toEqual([]);
    expect(model.windows.map((window) => window.label)).toEqual(["30 days", "60 days", "90 days", "180 days"]);
    expect(RENEWALS_EMPTY_STATE).toBe("Add renewal and notice dates to see upcoming contract decisions.");
  });

  it("normalizes release-state windows and legacy horizon aliases", () => {
    expect(normalizeRenewalWindow({ window: "30" })).toBe("30");
    expect(normalizeRenewalWindow({ window: "60_days" })).toBe("60");
    expect(normalizeRenewalWindow({ window: "365" })).toBe("90");
    expect(normalizeRenewalWindow({ horizon: "renewal_30" })).toBe("30");
    expect(normalizeRenewalWindow({ horizon: "notice_deadline_90" })).toBe("90");
    expect(normalizeRenewalWindow({ horizon: "renewal_365" })).toBe("180");
    expect(normalizeRenewalWindow({})).toBe("90");
  });

  it("derives explicit and computed notice dates", () => {
    const explicit = build({
      contracts: [contract()],
      fields: [
        field("c1", "renewal_date", "2026-06-20"),
        field("c1", "notice_date", "2026-05-25"),
      ],
      window: "90",
    });
    expect(explicit.rows[0]?.renewalDate).toBe("2026-06-20");
    expect(explicit.rows[0]?.noticeDate).toBe("2026-05-25");

    const computed = build({
      contracts: [contract()],
      fields: [
        field("c1", "renewal_date", "2026-06-20"),
        field("c1", "notice_window", "30 days"),
      ],
      window: "90",
    });
    expect(computed.rows[0]?.noticeDate).toBe("2026-05-21");
  });

  it("derives release-state statuses", () => {
    const ownerGap = build({
      contracts: [contract({ owner_id: null })],
      fields: [
        field("c1", "renewal_date", "2026-07-01"),
        field("c1", "notice_date", "2026-06-01"),
      ],
    });
    expect(ownerGap.rows[0]?.status).toBe("needs_owner");

    const needsReview = build({
      contracts: [contract()],
      fields: [field("c1", "renewal_date", "2026-07-01", "pending")],
      status: "needs_review",
    });
    expect(needsReview.rows[0]?.status).toBe("needs_review");

    const noticeOpen = build({
      contracts: [contract()],
      fields: [
        field("c1", "renewal_date", "2026-06-01"),
        field("c1", "notice_window", "30 days"),
      ],
    });
    expect(noticeOpen.rows[0]?.status).toBe("notice_window_open");

    const inProgress = build({
      contracts: [contract()],
      fields: [
        field("c1", "renewal_date", "2026-08-10"),
        field("c1", "notice_date", "2026-07-10"),
      ],
      checkpoints: [{ id: "cp1", contract_id: "c1", status: "pending", due_date: "2026-07-01" }],
    });
    expect(inProgress.rows[0]?.status).toBe("in_progress");

    const completed = build({
      contracts: [contract()],
      fields: [
        field("c1", "renewal_date", "2026-08-10"),
        field("c1", "notice_date", "2026-07-10"),
      ],
      checkpoints: [{ id: "cp1", contract_id: "c1", status: "completed", due_date: "2026-07-01" }],
    });
    expect(completed.rows[0]?.status).toBe("completed");

    const noAction = build({
      contracts: [contract()],
      fields: [
        field("c1", "renewal_date", "2026-08-10"),
        field("c1", "notice_date", "2026-07-10"),
      ],
    });
    expect(noAction.rows[0]?.status).toBe("no_renewal_action_needed");
  });

  it("applies owner, counterparty, and status filters", () => {
    const model = build({
      contracts: [
        contract({ id: "c1", counterparty: "Atlas Cloud Systems" }),
        contract({ id: "c2", title: "Beta Agreement", counterparty: "Beta LLC", owner_id: null }),
      ],
      fields: [
        field("c1", "renewal_date", "2026-06-20"),
        field("c1", "notice_date", "2026-06-01"),
        field("c2", "renewal_date", "2026-06-20"),
        field("c2", "notice_date", "2026-06-01"),
      ],
      owner: "unassigned",
      counterparty: "Beta LLC",
      status: "needs_owner",
    });
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.title).toBe("Beta Agreement");
  });

  it("preserves partial loader warnings with navigable rows", () => {
    const model = build({
      contracts: [contract()],
      fields: [
        field("c1", "renewal_date", "2026-06-20"),
        field("c1", "notice_date", "2026-06-01"),
      ],
      warnings: ["work_items"],
    });
    expect(model.warnings).toEqual(["work_items"]);
    expect(model.rows).toHaveLength(1);
  });
});
