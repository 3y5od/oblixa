import { describe, expect, it } from "vitest";
import {
  buildV10CommandSearchRecovery,
  buildV10CommandTelemetryDetails,
  contractMatchRank,
  resolveV10CommandSearchPlan,
  selectV10DiverseCommandResults,
  v10CommandActionLabel,
  v10IndexedResultRank,
  v10IndexedRowPassesStaticVisibility,
} from "./route";

describe("V10 command palette contract ranking", () => {
  it("orders exact title, title prefix, counterparty prefix, and owner fallback matches", () => {
    expect(contractMatchRank("acme msa", { title: "Acme MSA", counterparty: "Beta Inc" })).toBe(0);
    expect(contractMatchRank("acme", { title: "Acme Master Services", counterparty: "Beta Inc" })).toBe(1);
    expect(contractMatchRank("beta", { title: "Services Agreement", counterparty: "Beta Inc" })).toBe(2);
    expect(contractMatchRank("taylor", { title: "Services Agreement", counterparty: "Beta Inc", ownerLabel: "Taylor Ops" })).toBe(5);
  });

  it("prioritizes V10 work recovery states before generic indexed matches", () => {
    expect(
      v10IndexedResultRank("soc", {
        record_type: "work_item",
        label: "SOC 2 evidence",
        description_safe: "overdue evidence request",
        rank_terms_safe: ["soc", "evidence"],
      })
    ).toBeLessThan(
      v10IndexedResultRank("soc", {
        record_type: "contract",
        label: "SOC 2 MSA",
        description_safe: "contract record",
        rank_terms_safe: ["soc"],
      })
    );
    expect(
      v10IndexedResultRank("job", {
        record_type: "import_job",
        label: "Import job",
        description_safe: "failed_retryable import",
        rank_terms_safe: ["job"],
      })
    ).toBe(1);
    expect(
      v10IndexedResultRank("delivery", {
        record_type: "notification_delivery",
        label: "Evidence rejected delivery",
        description_safe: "notification delivery · failed · email",
        rank_terms_safe: ["delivery", "failed"],
      })
    ).toBe(1);
    expect(
      v10IndexedResultRank("view", {
        record_type: "saved_view",
        label: "Weekly obligations",
        description_safe: "obligations saved view · pinned",
        rank_terms_safe: ["saved view", "pinned", "obligations"],
      })
    ).toBe(2);
    expect(
      v10IndexedResultRank("approval", {
        record_type: "approval",
        label: "Renewal approval",
        description_safe: "Approval · pending",
        rank_terms_safe: ["approval", "pending"],
      })
    ).toBe(1);
    expect(
      v10IndexedResultRank("exception", {
        record_type: "exception",
        label: "Missing notice clause",
        description_safe: "Exception · critical · open",
        rank_terms_safe: ["exception", "critical"],
      })
    ).toBe(1);
    expect(
      v10IndexedResultRank("report", {
        record_type: "report_run",
        label: "Obligation overview run",
        description_safe: "Report run · running",
        rank_terms_safe: ["report", "running"],
      })
    ).toBe(1);
    expect(
      v10IndexedResultRank("extract", {
        record_type: "extraction_job",
        label: "Extraction job",
        description_safe: "extraction · failed_retryable",
        rank_terms_safe: ["extract", "failed_retryable"],
      })
    ).toBe(1);
    expect(
      v10IndexedResultRank("refresh", {
        record_type: "workspace_health_diagnostic",
        label: "full refresh diagnostic",
        description_safe: "refresh partial · partial · 1 failure",
        rank_terms_safe: ["refresh", "contracts"],
      })
    ).toBe(1);
  });

  it("prioritizes enriched advanced and assurance indexed states", () => {
    expect(
      v10IndexedResultRank("approv", {
        record_type: "playbook",
        label: "Adaptive playbook run",
        description_safe: "awaiting approval · linked finding",
        rank_terms_safe: ["awaiting_approval", "finding_1", "playbook"],
      })
    ).toBe(1);
    expect(
      v10IndexedResultRank("rollback", {
        record_type: "campaign",
        label: "Notice campaign",
        description_safe: "renewal notice · active · 2 contracts · rollback safe",
        rank_terms_safe: ["notice campaign", "renewal_notice", "active", "2", "rollback safe", "campaign"],
      })
    ).toBe(2);
    expect(
      v10IndexedResultRank("degrad", {
        record_type: "relationship",
        label: "Acme Inc relationship",
        description_safe: "Relationship timeline · degraded · 2 contracts",
        rank_terms_safe: ["Acme Inc", "relationship", "timeline", "account"],
      })
    ).toBe(2);
    expect(
      v10IndexedResultRank("target", {
        record_type: "program_evolution",
        label: "Renewal blueprint improves health",
        description_safe: "simulated · program evolution · linked program · target segment",
        rank_terms_safe: ["experiment", "program evolution", "program_1", "segment_1"],
      })
    ).toBe(2);
    expect(
      v10IndexedResultRank("publish", {
        record_type: "program",
        label: "Renewal blueprint",
        description_safe: "published · Reusable renewal workflow",
        rank_terms_safe: ["renewal blueprint", "published", "version_1", "program"],
      })
    ).toBe(2);
    expect(
      v10IndexedResultRank("score", {
        record_type: "scorecard",
        label: "Control scorecard",
        description_safe: "Score 82 · active · owner assigned",
        rank_terms_safe: ["control scorecard", "82", "active", "user_1", "scorecard"],
      })
    ).toBe(2);
    expect(
      v10IndexedResultRank("link", {
        record_type: "health_graph",
        label: "Portfolio health graph",
        description_safe: "control gap · linked nodes",
        rank_terms_safe: ["control_gap", "finding_1", "control_1", "health graph"],
      })
    ).toBe(3);
  });

  it("keeps less common V10 command destination types before filling repeated results", () => {
    const results = [
      ...Array.from({ length: 10 }, (_, index) => ({
        resultType: "contract",
        rank: index === 0 ? 0 : 1,
        updatedAt: 100 - index,
        tieBreaker: `contract:${index}`,
      })),
      { resultType: "report run", rank: 4, updatedAt: 10, tieBreaker: "report:1" },
      { resultType: "failed job", rank: 3, updatedAt: 11, tieBreaker: "job:1" },
      { resultType: "setting", rank: 5, updatedAt: 9, tieBreaker: "setting:1" },
    ];

    const selected = selectV10DiverseCommandResults(results, 5);

    expect(selected.map((result) => result.resultType)).toEqual(
      expect.arrayContaining(["contract", "report run", "failed job", "setting"])
    );
    expect(selected).toHaveLength(5);
  });

  it("labels V10 job recovery results with concrete retry or diagnostic actions", () => {
    expect(
      v10CommandActionLabel({
        record_type: "work_item",
        description_safe: "approval · open",
      })
    ).toBe("Open work");
    expect(
      v10CommandActionLabel({
        record_type: "import_job",
        description_safe: "failed_retryable import",
      })
    ).toBe("Retry failed job");
    expect(
      v10CommandActionLabel({
        record_type: "report_run",
        description_safe: "failed_terminal report generation",
      })
    ).toBe("View diagnostics");
    expect(
      v10CommandActionLabel({
        record_type: "field",
        description_safe: "field · missing · msa",
      })
    ).toBe("Open field");
    expect(
      v10CommandActionLabel({
        record_type: "reminder",
        description_safe: "renewal reminder · scheduled 2027-02-01 · msa",
      })
    ).toBe("Open renewal");
    expect(
      v10CommandActionLabel({
        record_type: "saved_view",
        description_safe: "tasks saved view · pinned",
      })
    ).toBe("Open saved view");
    expect(
      v10CommandActionLabel({
        record_type: "approval",
        description_safe: "Approval · pending",
      })
    ).toBe("Open approval");
    expect(
      v10CommandActionLabel({
        record_type: "exception",
        description_safe: "Exception · high · open",
      })
    ).toBe("Open exception");
    expect(
      v10CommandActionLabel({
        record_type: "report_family",
        description_safe: "Core V10 report family",
      })
    ).toBe("Open reports");
    expect(
      v10CommandActionLabel({
        record_type: "simulation",
        description_safe: "campaign eligibility impact · completed",
      })
    ).toBe("Open compare view");
    expect(
      v10CommandActionLabel({
        record_type: "setting_destination",
        description_safe: "Settings destination",
      })
    ).toBe("Open settings");
    expect(
      v10CommandActionLabel({
        record_type: "nav",
        description_safe: "Primary navigation destination",
      })
    ).toBe("Open page");
    expect(
      v10CommandActionLabel({
        record_type: "file_upload",
        description_safe: "contract file · pdf · msa",
      })
    ).toBe("Open contract");
    expect(
      v10CommandActionLabel({
        record_type: "extraction_job",
        description_safe: "extraction · failed_retryable",
      })
    ).toBe("Open extraction");
    expect(
      v10CommandActionLabel({
        record_type: "notification_delivery",
        description_safe: "notification delivery · failed · email",
      })
    ).toBe("View diagnostics");
    expect(
      v10CommandActionLabel({
        record_type: "workspace_health_diagnostic",
        description_safe: "refresh partial · partial · 1 failure",
      })
    ).toBe("View diagnostics");
    expect(
      v10CommandActionLabel({
        record_type: "account",
        description_safe: "Account operational summary · watch · 1 contracts",
      })
    ).toBe("Open workspace");
    expect(
      v10CommandActionLabel({
        record_type: "playbook",
        description_safe: "awaiting approval · linked finding",
      })
    ).toBe("Open playbook");
    expect(
      v10CommandActionLabel({
        record_type: "finding",
        description_safe: "high · open · control gap · 1 contracts",
      })
    ).toBe("Open finding");
    expect(
      v10CommandActionLabel({
        record_type: "program_evolution",
        description_safe: "simulated · program evolution · linked program · target segment",
      })
    ).toBe("Open experiment");
    expect(
      v10CommandActionLabel({
        record_type: "contract",
        description_safe: "contract record",
      })
    ).toBe("Open contract");
    expect(
      v10CommandActionLabel({
        record_type: "counterparty",
        description_safe: "Counterparty operational summary · degraded · 2 contracts",
      })
    ).toBe("Open workspace");
    expect(
      v10CommandActionLabel({
        record_type: "relationship",
        description_safe: "Relationship timeline · degraded · 2 contracts",
      })
    ).toBe("Open relationship");
    expect(
      v10CommandActionLabel({
        record_type: "decision",
        description_safe: "renewal recommendation · open · acme-inc · 1 contracts",
      })
    ).toBe("Open decision");
    expect(
      v10CommandActionLabel({
        record_type: "campaign",
        description_safe: "renewal notice · active · 2 contracts · rollback safe",
      })
    ).toBe("Open campaign");
    expect(
      v10CommandActionLabel({
        record_type: "program",
        description_safe: "published · Reusable renewal workflow",
      })
    ).toBe("Open program");
    expect(
      v10CommandActionLabel({
        record_type: "control",
        description_safe: "warn · published · high",
      })
    ).toBe("Open control");
    expect(
      v10CommandActionLabel({
        record_type: "automation_run",
        description_safe: "awaiting approval · linked finding",
      })
    ).toBe("Open automation");
    expect(
      v10CommandActionLabel({
        record_type: "scorecard",
        description_safe: "Score 82 · active · owner assigned",
      })
    ).toBe("Open scorecard");
    expect(
      v10CommandActionLabel({
        record_type: "review_board",
        description_safe: "active · board workflow · owner assigned",
      })
    ).toBe("Open review board");
    expect(
      v10CommandActionLabel({
        record_type: "health_graph",
        description_safe: "control gap · linked nodes",
      })
    ).toBe("Open health graph");
    expect(
      v10CommandActionLabel({
        record_type: "segment",
        description_safe: "region · active",
      })
    ).toBe("Open segment");
    expect(
      v10CommandActionLabel({
        record_type: "setting",
        description_safe: "Settings home destination",
      })
    ).toBe("Open settings");
  });

  it("does not fall back to generic destination copy for current indexed record types", () => {
    const rows = [
      { record_type: "contract", description_safe: "contract record" },
      { record_type: "work_item", description_safe: "approval · open" },
      { record_type: "field", description_safe: "field · missing" },
      { record_type: "reminder", description_safe: "renewal reminder · scheduled" },
      { record_type: "obligation", description_safe: "obligation · open" },
      { record_type: "approval", description_safe: "approval · pending" },
      { record_type: "renewal_checkpoint", description_safe: "checkpoint · open" },
      { record_type: "exception", description_safe: "exception · high" },
      { record_type: "evidence_request", description_safe: "evidence request · open" },
      { record_type: "report_run", description_safe: "report run · completed" },
      { record_type: "file_upload", description_safe: "contract file · pdf" },
      { record_type: "notification_delivery", description_safe: "notification delivery · failed" },
      { record_type: "workspace_health_diagnostic", description_safe: "refresh partial · partial" },
      { record_type: "report_family", description_safe: "Core V10 report family" },
      { record_type: "saved_view", description_safe: "tasks saved view" },
      { record_type: "account", description_safe: "account operational summary · watch" },
      { record_type: "counterparty", description_safe: "counterparty operational summary · degraded" },
      { record_type: "relationship", description_safe: "relationship timeline · degraded" },
      { record_type: "decision", description_safe: "renewal recommendation · open" },
      { record_type: "campaign", description_safe: "renewal notice · active" },
      { record_type: "program", description_safe: "published · reusable workflow" },
      { record_type: "finding", description_safe: "high · open · control gap" },
      { record_type: "control", description_safe: "warn · published" },
      { record_type: "playbook", description_safe: "awaiting approval" },
      { record_type: "automation_run", description_safe: "awaiting approval" },
      { record_type: "simulation", description_safe: "renewal · completed" },
      { record_type: "scorecard", description_safe: "Score 82 · active" },
      { record_type: "review_board", description_safe: "active · board workflow" },
      { record_type: "health_graph", description_safe: "control gap · linked nodes" },
      { record_type: "segment", description_safe: "region · active" },
      { record_type: "program_evolution", description_safe: "simulated · program evolution" },
      { record_type: "setting", description_safe: "Settings home destination" },
      { record_type: "setting_destination", description_safe: "Settings destination" },
      { record_type: "nav", description_safe: "Primary navigation destination" },
      { record_type: "import_job", description_safe: "import · completed" },
      { record_type: "export_job", description_safe: "export · completed" },
      { record_type: "extraction_job", description_safe: "extraction · completed" },
    ];

    for (const row of rows) {
      expect(v10CommandActionLabel(row)).not.toBe("Open destination");
    }
  });

  it("hides Advanced and Assurance indexed rows from Core command search before ranking", () => {
    expect(
      v10IndexedRowPassesStaticVisibility("viewer", "core", "enterprise", {
        required_role_minimum: "viewer",
        workspace_mode_minimum: "advanced",
        plan_minimum: "advanced",
      })
    ).toBe(false);
    expect(
      v10IndexedRowPassesStaticVisibility("admin", "advanced", "advanced", {
        required_role_minimum: "viewer",
        workspace_mode_minimum: "advanced",
        plan_minimum: "advanced",
      })
    ).toBe(true);
    expect(
      v10IndexedRowPassesStaticVisibility("manager", "advanced", "enterprise", {
        required_role_minimum: "viewer",
        workspace_mode_minimum: "assurance",
        plan_minimum: "assurance",
      })
    ).toBe(false);
    expect(
      v10IndexedRowPassesStaticVisibility("admin", "assurance", "core", {
        required_role_minimum: "viewer",
        workspace_mode_minimum: "core",
        plan_minimum: "assurance",
      })
    ).toBe(false);
  });

  it("resolves command search plan separately from workspace mode", () => {
    expect(resolveV10CommandSearchPlan({ v6: { billing_plan: "advanced" } })).toBe("advanced");
    expect(resolveV10CommandSearchPlan({ v6: { subscription_plan: "enterprise" } })).toBe("enterprise");
    expect(resolveV10CommandSearchPlan({ v6: { workspace_mode: "assurance" } })).toBe("enterprise");
  });

  it("returns safe recovery actions for short, zero-result, and partial-index searches", () => {
    expect(buildV10CommandSearchRecovery({ query: "a", resultCount: 0, partialIndex: false, mode: "core" })).toMatchObject({
      diagnosticId: "v10_command_search_short_query",
      actions: [{ href: "/work", reason: "short_query" }],
    });
    expect(buildV10CommandSearchRecovery({ query: "unknown vendor", resultCount: 0, partialIndex: false, mode: "core" })).toMatchObject({
      message: expect.stringContaining("No command result matched"),
      diagnosticId: "v10_command_zero_result",
      actions: expect.arrayContaining([
        { label: "Open work queue", href: "/work", reason: "zero_result" },
        { label: "Open reports", href: "/reports", reason: "zero_result" },
        { label: "Check system health", href: "/settings/health", reason: "zero_result" },
        { label: "Open product settings", href: "/settings/product", reason: "zero_result" },
      ]),
    });
    expect(buildV10CommandSearchRecovery({ query: "report", resultCount: 2, partialIndex: true, mode: "advanced" })).toMatchObject({
      diagnosticId: "v10_command_index_partial",
      actions: expect.arrayContaining([{ label: "Open decisions", href: "/decisions", reason: "partial_index" }]),
    });
    expect(buildV10CommandSearchRecovery({ query: "finding", resultCount: 0, partialIndex: false, mode: "assurance" })).toMatchObject({
      actions: expect.arrayContaining([{ label: "Open assurance", href: "/assurance", reason: "zero_result" }]),
    });
    expect(
      buildV10CommandSearchRecovery({
        query: "assurance",
        resultCount: 1,
        partialIndex: false,
        mode: "advanced",
        hiddenFilteredCount: 2,
      })
    ).toMatchObject({
      diagnosticId: "v10_command_hidden_module_filtered",
      actions: expect.arrayContaining([{ label: "Review hidden modules", href: "/settings/product", reason: "hidden_module_filtered" }]),
    });
    expect(buildV10CommandSearchRecovery({ query: "acme", resultCount: 1, partialIndex: false, mode: "core" })).toBeNull();
  });

  it("separates partial-index telemetry from true zero-result searches", () => {
    expect(buildV10CommandTelemetryDetails({ resultType: "contract", resultCount: 3, v10IndexError: true })).toMatchObject({
      zero_result: false,
      recovery_used: true,
      v10_index_error: true,
      hidden_filtered_count: 0,
    });
    expect(buildV10CommandTelemetryDetails({ resultType: "none", resultCount: 0, v10IndexError: false })).toMatchObject({
      zero_result: true,
      recovery_used: false,
      v10_index_error: false,
    });
    expect(
      buildV10CommandTelemetryDetails({
        resultType: "setting",
        resultCount: 2,
        v10IndexError: false,
        hiddenFilteredCount: 3,
        recoveryDiagnosticId: "v10_command_hidden_module_filtered",
      })
    ).toMatchObject({
      zero_result: false,
      recovery_used: true,
      hidden_filtered_count: 3,
      recovery_diagnostic_id: "v10_command_hidden_module_filtered",
    });
  });
});
