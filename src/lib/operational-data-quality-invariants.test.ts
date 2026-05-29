import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  OPERATIONAL_DATA_QUALITY_CONFIG,
  addUtcDays,
  buildDataQualityReport,
  buildImportReconciliationReport,
  canTransitionContractStatus,
  dedupeByKey,
  escapeCsvCell,
  evaluateReadModelSafety,
  fiscalYearForDate,
  normalizeImportRow,
  normalizeSearchQuery,
  paginateStable,
  parseCurrencyAmount,
  resolveCacheInvalidationDecision,
  serializeUrlState,
  sortRecordsStable,
  validateDomainRecord,
  type OperationalDomainRecord,
} from "@/lib/operational-data-quality-invariants";

const REQUIRED_INVARIANTS = [
  "contract-ownership",
  "contract-status-transitions",
  "renewal-date-ordering",
  "notice-window-ordering",
  "obligation-lifecycle",
  "evidence-requirements",
  "approval-quorum",
  "exception-state",
  "task-dependencies",
  "report-scope",
  "billing-status",
  "workspace-mode",
  "team-membership",
  "counterparty-data",
  "financial-fields",
];

const validRecord = (): OperationalDomainRecord => ({
  contract: {
    id: "contract_1",
    organizationId: "org_1",
    title: "Vendor MSA",
    ownerId: "user_owner",
    createdBy: "user_creator",
    status: "active",
    effectiveDate: "2026-01-01",
    endDate: "2026-12-31",
    renewalDate: "2026-11-30",
    noticeDeadline: "2026-10-31",
    counterparty: "Acme Legal Services",
    annualValue: 120000,
    currency: "USD",
    billingStatus: "active",
    workspaceMode: "enterprise",
    stripeSubscriptionId: "sub_123",
  },
  obligations: [
    {
      id: "obligation_1",
      contractId: "contract_1",
      organizationId: "org_1",
      status: "done",
      ownerId: "user_owner",
      evidenceRequired: true,
      evidenceRequestIds: ["evidence_1"],
      dueDate: "2026-03-01",
      completedAt: "2026-02-28T12:00:00.000Z",
    },
  ],
  evidenceRequirements: [
    {
      id: "evidence_1",
      contractId: "contract_1",
      organizationId: "org_1",
      status: "approved",
      requesterUserId: "user_requester",
      reviewerUserId: "user_reviewer",
      submissionCount: 1,
      dueDate: "2026-03-01",
      reviewedAt: "2026-02-27T12:00:00.000Z",
      rejectionReason: null,
    },
  ],
  approvals: [
    {
      id: "approval_1",
      contractId: "contract_1",
      organizationId: "org_1",
      status: "approved",
      approverUserId: "user_approver",
      decidedAt: "2026-01-15T12:00:00.000Z",
    },
  ],
  approvalQuorum: 1,
  exceptions: [
    {
      id: "exception_1",
      contractId: "contract_1",
      organizationId: "org_1",
      status: "resolved",
      severity: "medium",
      ownerId: "user_owner",
      resolutionAction: "Accepted mitigations",
      resolvedAt: "2026-02-01T12:00:00.000Z",
      reopenedAt: null,
    },
  ],
  tasks: [
    {
      id: "task_1",
      contractId: "contract_1",
      organizationId: "org_1",
      status: "done",
      assigneeId: "user_owner",
      parentTaskId: null,
      blockedByTaskId: null,
      blockedReason: null,
      completedAt: "2026-02-01T12:00:00.000Z",
    },
  ],
  reports: [
    {
      id: "report_1",
      contractId: "contract_1",
      organizationId: "org_1",
      reportRunOrganizationId: "org_1",
    },
  ],
  teamMemberships: [
    {
      id: "member_1",
      organizationId: "org_1",
      userId: "user_owner",
      teamKey: "legal",
      role: "legal_reviewer",
    },
  ],
});

describe("operational data quality invariant registry", () => {
  it("maps every required invariant to owner, severity, command, fixture, guard, test, and remediation", () => {
    const ids = new Set(OPERATIONAL_DATA_QUALITY_CONFIG.domainInvariants.map((row) => row.id));
    expect(ids).toEqual(new Set(REQUIRED_INVARIANTS));

    for (const invariant of OPERATIONAL_DATA_QUALITY_CONFIG.domainInvariants) {
      expect(invariant.ownerArea).toMatch(/\S/u);
      expect(["P0", "P1", "P2"]).toContain(invariant.severity);
      expect(invariant.validationCommand).toBe("test:operational-data-quality-invariants");
      expect(invariant.fixture).toMatch(/\S/u);
      expect(invariant.runtimeGuard).toMatch(/\S/u);
      expect(invariant.testRef).toBe("src/lib/operational-data-quality-invariants.test.ts");
      expect(invariant.remediationHint).toMatch(/\S/u);
    }
  });

  it("accepts a valid operational domain record", () => {
    expect(validateDomainRecord(validRecord())).toEqual([]);
  });

  it("rejects invalid domain records across the full invariant set", () => {
    const record = validRecord();
    record.contract.ownerId = null;
    record.contract.status = "active";
    record.contract.effectiveDate = "2027-01-01";
    record.contract.renewalDate = "2027-02-01";
    record.contract.noticeDeadline = "2027-03-01";
    record.contract.counterparty = "\u0000";
    record.contract.annualValue = -1;
    record.contract.currency = "usd";
    record.contract.billingStatus = "active";
    record.contract.workspaceMode = "ultimate";
    record.contract.stripeSubscriptionId = null;
    record.obligations = [{ ...record.obligations![0]!, status: "done", completedAt: null, evidenceRequestIds: [] }];
    record.evidenceRequirements = [{ ...record.evidenceRequirements![0]!, status: "approved", reviewerUserId: null, submissionCount: 0 }];
    record.approvals = [{ ...record.approvals![0]!, status: "approved", approverUserId: null, decidedAt: null }];
    record.approvalQuorum = 2;
    record.exceptions = [{ ...record.exceptions![0]!, status: "resolved", resolutionAction: null, resolvedAt: null }];
    record.tasks = [{ ...record.tasks![0]!, id: "task_self", status: "blocked", parentTaskId: "task_self", completedAt: null }];
    record.reports = [{ ...record.reports![0]!, organizationId: "org_2" }];
    record.teamMemberships = [
      { ...record.teamMemberships![0]!, id: "member_1" },
      { ...record.teamMemberships![0]!, id: "member_2" },
      { ...record.teamMemberships![0]!, id: "member_3", role: "owner" },
    ];

    const invalidStatusRecord = validRecord();
    invalidStatusRecord.contract.status = "bogus";

    const invariantIds = [
      ...new Set([...validateDomainRecord(record), ...validateDomainRecord(invalidStatusRecord)].map((violation) => violation.invariantId)),
    ];
    expect(invariantIds).toEqual(expect.arrayContaining(REQUIRED_INVARIANTS));
  });

  it("keeps status transitions explicit, including terminal-state recovery rules", () => {
    expect(canTransitionContractStatus("draft", "pending_review")).toBe(true);
    expect(canTransitionContractStatus("pending_review", "active")).toBe(true);
    expect(canTransitionContractStatus("active", "terminated")).toBe(true);
    expect(canTransitionContractStatus("terminated", "active")).toBe(true);
    expect(canTransitionContractStatus("draft", "active")).toBe(false);
    expect(canTransitionContractStatus("active", "pending_review")).toBe(false);
    expect(canTransitionContractStatus("bogus", "active")).toBe(false);
  });
});

describe("operational data quality property and fuzz coverage", () => {
  it("handles UTC date arithmetic across leap years, DST boundaries, and month ends", () => {
    expect(addUtcDays(new Date("2024-02-28T00:00:00.000Z"), 1).toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(addUtcDays(new Date("2026-03-08T00:00:00.000Z"), 1).toISOString().slice(0, 10)).toBe("2026-03-09");
    expect(addUtcDays(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(fiscalYearForDate(new Date("2026-03-31T00:00:00.000Z"), 4)).toBe(2025);
    expect(fiscalYearForDate(new Date("2026-04-01T00:00:00.000Z"), 4)).toBe(2026);

    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01T00:00:00.000Z"), max: new Date("2030-12-31T00:00:00.000Z") }),
        fc.integer({ min: -730, max: 730 }),
        (date, days) => {
          const next = addUtcDays(date, days);
          expect(Number.isNaN(next.getTime())).toBe(false);
          expect(next.getUTCHours()).toBe(0);
        },
      ),
      { numRuns: 120 },
    );
  });

  it("parses money without overflow and keeps minor units stable", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9_999_999_999 }), (minorUnits) => {
        const raw = `${Math.floor(minorUnits / 100)}.${String(minorUnits % 100).padStart(2, "0")} USD`;
        const parsed = parseCurrencyAmount(raw);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.minorUnits).toBe(minorUnits);
      }),
      { numRuns: 100 },
    );

    expect(parseCurrencyAmount("-1 USD").ok).toBe(false);
    expect(parseCurrencyAmount("1000000000000000 USD").ok).toBe(false);
  });

  it("keeps pagination, sorting, filtering, deduplication, CSV escaping, and URL serialization safe for generated inputs", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 80 }), fc.integer(), fc.integer(), (values, page, size) => {
        const records = values.map((value, index) => ({ id: String(index), value }));
        const pageRows = paginateStable(records, page, size);
        expect(pageRows.length).toBeLessThanOrEqual(250);

        const sorted = sortRecordsStable(records, "value");
        expect(sorted.map((row) => row.id).sort()).toEqual(records.map((row) => row.id).sort());

        const deduped = dedupeByKey(records, (row) => row.value);
        expect(new Set(deduped.map((row) => row.value)).size).toBe(deduped.length);

        const query = normalizeSearchQuery(values.join(" "));
        expect(query).toBe(query.trim());
        expect(query.length).toBeLessThanOrEqual(200);

        for (const value of values.slice(0, 10)) {
          const escaped = escapeCsvCell(value);
          if (/^[=+\-@]/u.test(value)) {
            const visibleStart = escaped.startsWith("\"") ? escaped.slice(1) : escaped;
            expect(visibleStart.startsWith("'")).toBe(true);
          }
        }

        const serialized = serializeUrlState({ q: query, page, tags: values.slice(0, 5), empty: "" });
        expect(serialized).toBe(serializeUrlState({ tags: values.slice(0, 5), empty: "", page, q: query }));
      }),
      { numRuns: 80 },
    );
  });
});

describe("operational data-quality report artifacts", () => {
  it("returns a deterministic clean report for valid fixture rows", () => {
    const report = buildDataQualityReport({
      generatedAt: "2026-05-28T00:00:00.000Z",
      contracts: [
        {
          id: "contract_1",
          status: "active",
          ownerId: "user_owner",
          effectiveDate: "2026-01-01",
          endDate: "2026-12-31",
          renewalDate: "2026-11-30",
          noticeDeadline: "2026-10-31",
          counterparty: "Acme",
          billingStatus: "active",
          workspaceMode: "enterprise",
          stripeSubscriptionId: "sub_123",
        },
      ],
      tasks: [{ id: "task_1", contractId: "contract_1" }],
      evidenceRequirements: [{ id: "evidence_1", contractId: "contract_1" }],
      importJobs: [{ id: "job_1", status: "completed", updatedAt: "2026-05-28T00:00:00.000Z" }],
      readModels: [
        {
          id: "model_1",
          sourceTable: "contracts",
          sourceId: "contract_1",
          sourceUpdatedAt: "2026-05-28T00:00:00.000Z",
          computedAt: "2026-05-28T00:00:00.000Z",
          lineageId: "lineage_1",
        },
      ],
    });

    expect(report.issueCount).toBe(0);
    expect(report.coverage).toEqual(OPERATIONAL_DATA_QUALITY_CONFIG.dataQualityReportChecks);
  });

  it("reports missing owners, key dates, orphaned rows, stale imports, invalid enums, duplicate counterparties, and broken read models", () => {
    const report = buildDataQualityReport({
      generatedAt: "2026-05-28T00:00:00.000Z",
      contracts: [
        {
          id: "contract_1",
          status: "active",
          ownerId: null,
          effectiveDate: "2027-01-01",
          endDate: "2026-01-01",
          renewalDate: "2026-12-01",
          noticeDeadline: null,
          counterparty: "Acme",
          billingStatus: "active",
          workspaceMode: "enterprise",
          stripeSubscriptionId: null,
        },
        {
          id: "contract_2",
          status: "unknown",
          effectiveDate: "2026-02-30",
          counterparty: " acme ",
          billingStatus: "unmanaged",
          workspaceMode: "core",
        },
      ],
      tasks: [{ id: "task_1", contractId: "missing_contract" }],
      evidenceRequirements: [{ id: "evidence_1", contractId: "missing_contract" }],
      importJobs: [{ id: "job_1", status: "processing", updatedAt: "2026-05-26T00:00:00.000Z" }],
      readModels: [
        {
          id: "model_1",
          sourceTable: "contracts",
          sourceId: "missing_contract",
          sourceUpdatedAt: "2026-05-28T00:00:00.000Z",
          computedAt: "2026-05-27T00:00:00.000Z",
          lineageId: null,
        },
      ],
    });

    expect([...new Set(report.issues.map((issue) => issue.check))]).toEqual(
      expect.arrayContaining([
        "missing-owners",
        "missing-key-dates",
        "invalid-renewal-windows",
        "orphaned-tasks",
        "orphaned-evidence",
        "dangling-foreign-keys",
        "stale-imports",
        "duplicate-counterparties",
        "inconsistent-billing-metadata",
        "invalid-enum-values",
        "impossible-dates",
        "stale-derived-fields",
        "broken-read-models",
      ]),
    );
  });
});

describe("operational import normalization and reconciliation", () => {
  it("normalizes import rows deterministically and reports duplicate or malformed rows", () => {
    const rows = [
      {
        rowId: "row_2",
        fileHash: "hash_a",
        title: " Vendor MSA ",
        counterparty: "Acme, Inc.",
        ownerEmail: "OWNER@EXAMPLE.COM",
        effectiveDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      {
        rowId: "row_1",
        fileHash: "hash_a",
        title: "Vendor MSA",
        counterparty: " acme,   inc. ",
        ownerEmail: "owner@example.com",
        effectiveDate: "2026-13-01",
        endDate: "2026-12-31",
        encodingSample: "bad\uFFFDvalue",
      },
      {
        rowId: "row_3",
        fileHash: "hash_b",
        retryOfRowId: "row_1",
        title: "Vendor MSA",
        counterparty: "Acme, Inc.",
        ownerEmail: "owner@example.com",
        effectiveDate: "2026-01-01",
        endDate: "2026-12-31",
      },
    ];

    expect(normalizeImportRow(rows[0]!)).toMatchObject({
      title: "Vendor MSA",
      canonicalCounterparty: "acme, inc.",
      ownerEmail: "owner@example.com",
      valid: true,
    });

    const report = buildImportReconciliationReport(rows);
    expect(report.normalizedRows.map((row) => row.rowId)).toEqual(["row_1", "row_2", "row_3"]);
    expect(report.duplicateFileHashes).toEqual(["hash_a"]);
    expect(report.duplicateContractKeys).toEqual(["vendor msa|acme, inc.|2026-12-31"]);
    expect(report.partialRetryRowIds).toEqual(["row_3"]);
    expect(report.issueCount).toBeGreaterThanOrEqual(3);
    expect(buildImportReconciliationReport(rows)).toEqual(report);
  });
});

describe("operational read-model rebuild and cache safety", () => {
  it("accepts idempotent scoped read-model rebuilds and rejects stale, duplicate, missing, and drifting output", () => {
    const sourceRows = [
      {
        sourceTable: "contracts",
        sourceId: "contract_1",
        contractId: "contract_1",
        updatedAt: "2026-05-28T00:00:00.000Z",
        version: 2,
      },
    ];
    const currentRows = [
      {
        modelKey: "contract_health_snapshots",
        sourceTable: "contracts",
        sourceId: "contract_1",
        contractId: "contract_1",
        computedAt: "2026-05-28T00:00:00.000Z",
        version: 2,
        lineageId: "lineage_1",
        payloadHash: "hash_a",
      },
    ];

    expect(
      evaluateReadModelSafety({
        sourceRows,
        readModelRows: currentRows,
        rebuildRows: currentRows,
        scopeSourceIds: ["contract_1"],
      }),
    ).toMatchObject({ ok: true, issues: [] });

    const unsafe = evaluateReadModelSafety({
      sourceRows,
      readModelRows: currentRows,
      rebuildRows: [
        { ...currentRows[0]!, computedAt: "2026-05-27T00:00:00.000Z", version: 1, lineageId: null, payloadHash: "hash_b" },
        { ...currentRows[0]!, sourceId: "missing_contract", payloadHash: "hash_missing" },
        { ...currentRows[0]!, payloadHash: "hash_c" },
      ],
      scopeSourceIds: ["contract_2"],
    });

    expect(unsafe.ok).toBe(false);
    expect([...new Set(unsafe.issues.map((issue) => issue.check))]).toEqual(
      expect.arrayContaining([
        "rebuild-idempotency",
        "partial-rebuild",
        "stale-source-data",
        "missing-source-rows",
        "concurrent-rebuild",
        "output-drift",
        "lineage-required",
      ]),
    );
  });

  it("invalidates stale or sensitive cache entries and uses fallback reads when available", () => {
    expect(
      resolveCacheInvalidationDecision({
        cacheKey: "contract_1",
        cacheVersion: 1,
        sourceVersion: 2,
        sourceUpdatedAt: "2026-05-28T00:00:00.000Z",
        cacheGeneratedAt: "2026-05-27T00:00:00.000Z",
        sensitive: true,
        fallbackAvailable: true,
      }),
    ).toEqual({
      invalidate: true,
      bypassCache: true,
      fallbackRead: true,
      reasons: ["sensitive_cache_bypass", "source_version_newer", "source_updated_after_cache"],
    });

    expect(
      resolveCacheInvalidationDecision({
        cacheKey: "contract_1",
        cacheVersion: 2,
        sourceVersion: 2,
        sourceUpdatedAt: "2026-05-28T00:00:00.000Z",
        cacheGeneratedAt: "2026-05-28T00:00:00.000Z",
        sensitive: false,
        fallbackAvailable: true,
      }),
    ).toMatchObject({ invalidate: false, fallbackRead: false });
  });
});
