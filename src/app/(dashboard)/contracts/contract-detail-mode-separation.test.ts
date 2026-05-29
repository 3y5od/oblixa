import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONTRACT_DETAIL = join(process.cwd(), "src/app/(dashboard)/contracts/[id]/page.tsx");

function readDetailPage() {
  return readFileSync(CONTRACT_DETAIL, "utf8");
}

function between(raw: string, start: string, end: string) {
  const startIndex = raw.indexOf(start);
  const endIndex = raw.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return raw.slice(startIndex, endIndex);
}

describe("contract detail mode separation", () => {
  it("uses named mode guards for contract detail panels", () => {
    const raw = readDetailPage();
    for (const guard of [
      "showContractWorkflowOps",
      "showContractRenewalWorkspace",
      "showContractAdvancedRouting",
      "showContractEvidenceOps",
      "showContractAuditOps",
      "showContractRecordControls",
      "showContractFieldCollaboration",
      "showContractOwnerAssignment",
    ]) {
      expect(raw).toContain(guard);
    }
  });

  it("renders a Core-specific detail path before Advanced and Assurance surfaces", () => {
    const raw = readDetailPage();
    const corePath = between(raw, "if (isCoreContractDetail)", '<div className="space-y-7 md:space-y-8">');
    for (const label of [
      "Signed agreement",
      "Contract action summary",
      "Review fields",
      "Key dates",
      "Work, obligations, and exceptions",
      "Approval decisions",
      "Contract obligations",
      "Pending requests",
      "Contract activity",
      "Recent activity",
      "Date tracking is waiting on extraction",
      "Owner and status",
      "Open work",
    ]) {
      expect(corePath).toContain(label);
    }
    expect(corePath).toContain("DashboardPageHeader");
    expect(corePath).toContain("OwnerAssignmentForm");
    expect(corePath).toContain("shouldPrioritizeSourceDocuments");
    expect(corePath).toContain("renderCoreSourceDocumentsSection");
    const coreBranchInputs = between(raw, "const primaryAction =", "if (isCoreContractDetail)");
    // v23 aesthetic pass: the `coreActionQueue` compute block was
    // dropped per §10.4 (eliminate redundancy) + §10.14 (subtraction
    // is a design move) — the per-signal action links + the right-
    // column Open blockers panel already convey the same set of
    // blockers. `coreReviewSignal` is the surviving structural anchor
    // for the per-signal computed state.
    for (const label of [
      "Attach source file",
      "Source documents",
      "coreReviewSignal",
    ]) {
      expect(coreBranchInputs).toContain(label);
    }
    expect(corePath).not.toContain("More sections");
    for (const forbidden of [
      "Operational lifecycle",
      "Execution graph",
      "Inspect portfolio graph",
      "Operational evidence pack",
      "Download evidence pack (JSON)",
      "Program assignment overrides",
      "CRM / external link",
      "Renewal command context",
      "Workspace notes",
      "Operational casefile",
      "Ownership handoff checklist",
      "Danger zone",
      "Delete contract",
      "Unified workflow timeline",
      "Field comments & mentions",
      "Create clarification task",
    ]) {
      expect(corePath).not.toContain(forbidden);
    }
  });

  it("loads and summarizes evidence gaps for Core without exposing the Assurance evidence pack", () => {
    const raw = readDetailPage();
    expect(raw).toContain("isCoreContractDetail || showContractEvidenceOps");
    expect(raw).toContain("Pending requests");
    expect(raw).toContain("Request evidence");
    expect(raw).toContain("activeV10EvidenceCount");
    expect(raw).toContain('activeTab === "evidence"');
    const coreEvidenceSummary = between(raw, 'id="contract-evidence"', "{showContractWorkflowOps");
    expect(coreEvidenceSummary).toContain('id="contract-evidence"');
    expect(coreEvidenceSummary).toContain("/contracts/evidence-studio?contract=");
    expect(coreEvidenceSummary).not.toContain("Download evidence pack (JSON)");
  });

  it("links Core approval and work sections to Core-safe queues", () => {
    const raw = readDetailPage();
    expect(raw).toContain("/contracts/approvals?contract=");
    expect(raw).toContain("Open approval queue");
    expect(raw).toContain("/work?contract=");
    expect(raw).toContain("Create work");
  });

  it("keeps Core tabs fixed to the release-state detail surface", () => {
    const raw = readDetailPage();
    const tabConfig = between(raw, "const coreTabLinks", "const advancedTabLinks");
    for (const label of [
      "Overview",
      "Fields",
      "Dates",
      "Work",
      "Approvals",
      "Obligations",
      "Evidence",
      "Files",
      "Notes",
      "Activity",
    ]) {
      expect(tabConfig).toContain(label);
    }
    expect(tabConfig).not.toContain("hasBlockingApprovals");
    expect(tabConfig).not.toContain("hasActiveIssues");
    for (const forbidden of ["Workflow", "Renewals", "Programs", "Integrations", "Issues", "Casefile", "Timeline", "Audit", "Reports"]) {
      expect(tabConfig).not.toContain(`\"${forbidden}\"`);
    }
  });

  it("preserves Advanced workflow, renewal, routing, ownership, and collaboration surfaces", () => {
    const raw = readDetailPage();
    for (const label of [
      "Operational lifecycle",
      "Execution graph",
      "Inspect portfolio graph",
      "Program assignment overrides",
      "CRM / external link",
      "Renewal scenario & approvals",
      "Workspace notes",
      "Ownership handoff checklist",
      "Field comments & mentions",
      "Create clarification task",
    ]) {
      expect(raw).toContain(label);
    }
  });

  it("preserves Assurance evidence, audit, delivery history, approvals, and record controls", () => {
    const raw = readDetailPage();
    for (const label of [
      "Operational evidence pack",
      "Download evidence pack (JSON)",
      "Operational casefile",
      "Unified workflow timeline",
      "Activity",
      "Sent (history)",
      "Approval evidence and decision history",
      "Ownership & record",
      "DeleteContractButton",
    ]) {
      expect(raw).toContain(label);
    }
    expect(raw).toContain("humanizeAuditEventLabel");
  });

  it("keeps destructive record controls available outside assurance while gating deletion by role", () => {
    const raw = readDetailPage();
    expect(raw).toContain("const showContractRecordControls = true");
    expect(raw).toContain("{showContractRecordControls && (");
    expect(raw).toContain("const canDelete = canDeleteContracts(role as OrgRole)");
    expect(raw).toContain("canDelete={canDelete}");
  });
});
