import { beforeEach, describe, expect, it, vi } from "vitest";

const evaluateSingleControlPolicy = vi.fn();
const createRow = vi.fn();

vi.mock("@/lib/assurance/policy-evaluator", () => ({
  evaluateSingleControlPolicy: (...args: unknown[]) => evaluateSingleControlPolicy(...args),
}));

vi.mock("@/lib/assurance/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assurance/service")>("@/lib/assurance/service");
  return {
    ...actual,
    createRow: (...args: unknown[]) => createRow(...args),
  };
});

function adminWithNoExistingRows() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  };
}

describe("generateControlPolicyReviewWork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRow.mockImplementation(async (_admin, table: string, _orgId: string, row: Record<string, unknown>) => ({
      data: { id: `${table}-1`, ...row },
      error: null,
    }));
  });

  it("creates review tasks and evidence requirements for scoped published policy contracts", async () => {
    evaluateSingleControlPolicy.mockResolvedValue([
      {
        policy_id: "policy-1",
        policy_name: "Evidence freshness",
        enforcement_mode: "warn",
        remediation_playbook_id: null,
        pass: true,
        breaches: [],
        policy_json: {},
        version_payload: {},
        evaluation_unit_key: "policy-1:scope",
        scope: {
          assignment_id: "assignment-1",
          assignment_type: "contract",
          label: "Contracts",
          contract_ids: ["contract-1", "contract-2"],
        },
      },
    ]);

    const { generateControlPolicyReviewWork } = await import("@/lib/assurance/control-policies");
    const result = await generateControlPolicyReviewWork(adminWithNoExistingRows() as never, "org-1", "policy-1", "user-1", {
      policyName: "Evidence freshness",
      evidenceExpectationsJson: { schema: "v6.evidence_expectations.v1", min_fresh_coverage: 0.9 },
    });

    expect(result).toEqual({
      reviewTaskIds: ["contract_tasks-1", "contract_tasks-1"],
      evidenceRequirementIds: ["evidence_requirements-1", "evidence_requirements-1"],
      skippedReason: null,
    });
    expect(createRow).toHaveBeenCalledWith(
      expect.anything(),
      "contract_tasks",
      "org-1",
      expect.objectContaining({
        contract_id: "contract-1",
        title: "Review control policy: Evidence freshness",
        priority: "medium",
      })
    );
    expect(createRow).toHaveBeenCalledWith(
      expect.anything(),
      "evidence_requirements",
      "org-1",
      expect.objectContaining({
        contract_id: "contract-1",
        work_item_type: "control_policy_review",
        requirement_type: "attestation",
        title: "Evidence for control policy: Evidence freshness",
      })
    );
  });

  it("skips generation when a published policy has no scoped contracts", async () => {
    evaluateSingleControlPolicy.mockResolvedValue([
      {
        policy_id: "policy-1",
        policy_name: "Global rollup",
        scope: { contract_ids: [] },
      },
    ]);

    const { generateControlPolicyReviewWork } = await import("@/lib/assurance/control-policies");
    await expect(
      generateControlPolicyReviewWork(adminWithNoExistingRows() as never, "org-1", "policy-1", "user-1")
    ).resolves.toEqual({ reviewTaskIds: [], evidenceRequirementIds: [], skippedReason: "no_scoped_contracts" });
    expect(createRow).not.toHaveBeenCalled();
  });
});
