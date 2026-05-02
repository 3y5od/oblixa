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
        record_type: "contract",
        description_safe: "contract record",
      })
    ).toBe("Open destination");
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
