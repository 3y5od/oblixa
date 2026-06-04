import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/actions/policy-operations.ts"), "utf8");
const policyMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createAdminClient: vi.fn(),
  getOrEnsureDeterministicMembership: vi.fn(),
  hasRoleCapability: vi.fn(() => true),
  ensureProgramsSurfaceAccess: vi.fn(async (): Promise<null | { error: string }> => null),
  ensureReportPackReportTypeAllowed: vi.fn(async (): Promise<null | { error: string }> => null),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: policyMocks.getUser,
    },
  })),
  createAdminClient: policyMocks.createAdminClient,
  getOrEnsureDeterministicMembership: policyMocks.getOrEnsureDeterministicMembership,
}));

vi.mock("@/lib/access-control", () => ({
  hasRoleCapability: policyMocks.hasRoleCapability,
}));

vi.mock("@/actions/program-surface-guards", () => ({
  ensureProgramsSurfaceAccess: policyMocks.ensureProgramsSurfaceAccess,
  ensureReportPackReportTypeAllowed: policyMocks.ensureReportPackReportTypeAllowed,
}));

vi.mock("next/cache", () => ({
  revalidatePath: policyMocks.revalidatePath,
}));

vi.mock("@/lib/contract-operations/casefile", () => ({
  appendCasefileEvent: vi.fn(),
}));

vi.mock("@/lib/contract-operations/execution-engine", () => ({
  applyProgramToContract: vi.fn(),
}));

vi.mock("@/lib/contract-operations/renewal-decision-packet", () => ({
  buildRenewalDecisionPacketPayload: vi.fn(() => ({
    packet_json: {},
    assumptions_json: {},
  })),
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent: vi.fn(),
}));

vi.mock("@/lib/server-contracts", () => ({
  recordV10AuditEvent: vi.fn(),
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization: vi.fn(),
}));

function settingsQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: {
        organization_id: "org-1",
        role_policy_json: null,
      },
    })),
  };
  return query;
}

describe("policy operations action scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    policyMocks.createAdminClient.mockResolvedValue({
      from: vi.fn(() => settingsQuery()),
    });
    policyMocks.getOrEnsureDeterministicMembership.mockResolvedValue({
      organization_id: "org-1",
      role: "admin",
    });
    policyMocks.hasRoleCapability.mockReturnValue(true);
    policyMocks.ensureProgramsSurfaceAccess.mockResolvedValue(null);
    policyMocks.ensureReportPackReportTypeAllowed.mockResolvedValue(null);
  });

  function authenticate() {
    policyMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  }

  function form(entries: Record<string, string> = {}) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(entries)) {
      fd.set(key, value);
    }
    return fd;
  }

  it("returns an authentication failure before policy mutations without a user", () => {
    expect(SRC).toContain("supabase.auth.getUser()");
    expect(SRC).toContain('return { error: "Not authenticated" as const }');
  });

  it("keeps policy mutations scoped to the authenticated organization", () => {
    expect(SRC).toContain("getOrEnsureDeterministicMembership");
    expect(SRC).toContain("organization_id");
    expect(SRC).toContain("ensureProgramsSurfaceAccess(ctx)");
  });

  it.each([
    ["createProgramAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createProgramAction(form({ name: "Program" }))],
    ["publishProgramAction", async (actions: typeof import("@/actions/policy-operations")) => actions.publishProgramAction("program-1")],
    ["applyProgramAction", async (actions: typeof import("@/actions/policy-operations")) => actions.applyProgramAction(form({ programId: "program-1", contractIds: "contract-1" }))],
    ["createExceptionAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createExceptionAction(form({ title: "Exception" }))],
    ["createReportPackAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createReportPackAction(form({ name: "Pack" }))],
    ["saveProgramVersionDefinitionAction", async (actions: typeof import("@/actions/policy-operations")) => actions.saveProgramVersionDefinitionAction(form({ programId: "program-1", definitionJson: "{}" }))],
    ["updateProgramRoutingAction", async (actions: typeof import("@/actions/policy-operations")) => actions.updateProgramRoutingAction(form({ programId: "program-1" }))],
    ["updateProgramAssignmentOverrideAction", async (actions: typeof import("@/actions/policy-operations")) => actions.updateProgramAssignmentOverrideAction(form({ assignmentId: "assignment-1" }))],
    ["submitEvidenceNoteAction", async (actions: typeof import("@/actions/policy-operations")) => actions.submitEvidenceNoteAction(form({ requirementId: "req-1", note: "Done" }))],
    ["createEvidenceTemplateAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createEvidenceTemplateAction(form({ name: "Template" }))],
    ["savePolicyRegistryAction", async (actions: typeof import("@/actions/policy-operations")) => actions.savePolicyRegistryAction(form({ registryJson: "[]" }))],
    ["saveReportPackAnnotationsAction", async (actions: typeof import("@/actions/policy-operations")) => actions.saveReportPackAnnotationsAction(form({ reportPackId: "pack-1" }))],
    ["createReportPackSubscriptionAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createReportPackSubscriptionAction(form({ reportPackId: "pack-1" }))],
    ["updateRenewalCheckpointWorkspaceAction", async (actions: typeof import("@/actions/policy-operations")) => actions.updateRenewalCheckpointWorkspaceAction(form({ checkpointId: "checkpoint-1", workspaceJson: "{}" }))],
    ["updateRenewalCheckpointRenewalStateAction", async (actions: typeof import("@/actions/policy-operations")) => actions.updateRenewalCheckpointRenewalStateAction(form({ checkpointId: "checkpoint-1", renewalState: "under_review" }))],
    ["generateRenewalDecisionPacketAction", async (actions: typeof import("@/actions/policy-operations")) => actions.generateRenewalDecisionPacketAction(form({ checkpointId: "checkpoint-1" }))],
  ])("%s rejects unauthenticated users", async (_name, callAction) => {
    policyMocks.getUser.mockResolvedValue({ data: { user: null } });
    const actions = await import("@/actions/policy-operations");
    await expect(callAction(actions)).resolves.toEqual({ error: "Not authenticated" });
  });

  it("denies callers without the required role capability", async () => {
    authenticate();
    policyMocks.hasRoleCapability.mockReturnValue(false);
    const { createProgramAction } = await import("@/actions/policy-operations");
    await expect(createProgramAction(form({ name: "Program" }))).resolves.toEqual({ error: "Access denied" });
  });

  it("returns program surface gate failures before program mutations", async () => {
    authenticate();
    policyMocks.ensureProgramsSurfaceAccess.mockResolvedValue({ error: "Programs are disabled" });
    const { createProgramAction } = await import("@/actions/policy-operations");
    await expect(createProgramAction(form({ name: "Program" }))).resolves.toEqual({
      error: "Programs are disabled",
    });
  });

  it.each([
    ["createProgramAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createProgramAction(form()), "Name is required"],
    ["applyProgramAction", async (actions: typeof import("@/actions/policy-operations")) => actions.applyProgramAction(form()), "programId and at least one contract id are required"],
    ["createExceptionAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createExceptionAction(form()), "Title is required"],
    ["createReportPackAction", async (actions: typeof import("@/actions/policy-operations")) => actions.createReportPackAction(form()), "Name is required"],
    ["saveProgramVersionDefinitionAction missing fields", async (actions: typeof import("@/actions/policy-operations")) => actions.saveProgramVersionDefinitionAction(form()), "programId and definition JSON are required"],
    ["saveProgramVersionDefinitionAction bad JSON", async (actions: typeof import("@/actions/policy-operations")) => actions.saveProgramVersionDefinitionAction(form({ programId: "program-1", definitionJson: "{" })), "Invalid JSON"],
    ["updateProgramRoutingAction missing program", async (actions: typeof import("@/actions/policy-operations")) => actions.updateProgramRoutingAction(form()), "programId is required"],
    ["updateProgramRoutingAction bad auto JSON", async (actions: typeof import("@/actions/policy-operations")) => actions.updateProgramRoutingAction(form({ programId: "program-1", autoAssignmentRulesJson: "{" })), "autoAssignmentRulesJson must be valid JSON"],
    ["updateProgramRoutingAction bad default JSON", async (actions: typeof import("@/actions/policy-operations")) => actions.updateProgramRoutingAction(form({ programId: "program-1", defaultRoutingJson: "{" })), "defaultRoutingJson must be valid JSON"],
    ["updateProgramAssignmentOverrideAction missing assignment", async (actions: typeof import("@/actions/policy-operations")) => actions.updateProgramAssignmentOverrideAction(form()), "assignmentId is required"],
    ["updateProgramAssignmentOverrideAction bad JSON", async (actions: typeof import("@/actions/policy-operations")) => actions.updateProgramAssignmentOverrideAction(form({ assignmentId: "assignment-1", overrideJson: "{" })), "overrideJson must be valid JSON"],
    ["submitEvidenceNoteAction missing requirement", async (actions: typeof import("@/actions/policy-operations")) => actions.submitEvidenceNoteAction(form({ note: "Done" })), "requirementId is required"],
    ["submitEvidenceNoteAction missing note", async (actions: typeof import("@/actions/policy-operations")) => actions.submitEvidenceNoteAction(form({ requirementId: "req-1" })), "Note is required"],
    ["createEvidenceTemplateAction missing name", async (actions: typeof import("@/actions/policy-operations")) => actions.createEvidenceTemplateAction(form()), "Name is required"],
    ["createEvidenceTemplateAction bad JSON", async (actions: typeof import("@/actions/policy-operations")) => actions.createEvidenceTemplateAction(form({ name: "Template", templateJson: "{" })), "templateJson must be valid JSON"],
    ["savePolicyRegistryAction missing registry", async (actions: typeof import("@/actions/policy-operations")) => actions.savePolicyRegistryAction(form()), "registry JSON is required"],
    ["savePolicyRegistryAction bad JSON", async (actions: typeof import("@/actions/policy-operations")) => actions.savePolicyRegistryAction(form({ registryJson: "{" })), "Invalid JSON"],
    ["savePolicyRegistryAction non-array", async (actions: typeof import("@/actions/policy-operations")) => actions.savePolicyRegistryAction(form({ registryJson: "{}" })), "Policy registry must be a JSON array"],
    ["saveReportPackAnnotationsAction missing pack", async (actions: typeof import("@/actions/policy-operations")) => actions.saveReportPackAnnotationsAction(form()), "reportPackId is required"],
    ["createReportPackSubscriptionAction missing pack", async (actions: typeof import("@/actions/policy-operations")) => actions.createReportPackSubscriptionAction(form()), "reportPackId is required"],
    ["updateRenewalCheckpointWorkspaceAction missing checkpoint", async (actions: typeof import("@/actions/policy-operations")) => actions.updateRenewalCheckpointWorkspaceAction(form({ workspaceJson: "{}" })), "checkpointId is required"],
    ["updateRenewalCheckpointWorkspaceAction bad JSON", async (actions: typeof import("@/actions/policy-operations")) => actions.updateRenewalCheckpointWorkspaceAction(form({ checkpointId: "checkpoint-1", workspaceJson: "{" })), "workspaceJson must be valid JSON"],
    ["updateRenewalCheckpointRenewalStateAction missing checkpoint", async (actions: typeof import("@/actions/policy-operations")) => actions.updateRenewalCheckpointRenewalStateAction(form({ renewalState: "under_review" })), "checkpointId is required"],
    ["updateRenewalCheckpointRenewalStateAction bad state", async (actions: typeof import("@/actions/policy-operations")) => actions.updateRenewalCheckpointRenewalStateAction(form({ checkpointId: "checkpoint-1", renewalState: "unknown" })), "Invalid renewal state"],
    ["generateRenewalDecisionPacketAction missing checkpoint", async (actions: typeof import("@/actions/policy-operations")) => actions.generateRenewalDecisionPacketAction(form()), "checkpointId is required"],
  ])("%s validates required input before writes", async (_name, callAction, error) => {
    authenticate();
    const actions = await import("@/actions/policy-operations");
    await expect(callAction(actions)).resolves.toEqual({ error });
  });

  it("requires admin role before saving the policy registry", async () => {
    authenticate();
    policyMocks.getOrEnsureDeterministicMembership.mockResolvedValue({
      organization_id: "org-1",
      role: "member",
    });
    const { savePolicyRegistryAction } = await import("@/actions/policy-operations");
    await expect(savePolicyRegistryAction(form({ registryJson: "[]" }))).resolves.toEqual({
      error: "Access denied",
    });
  });

  it("form wrappers log validation errors without throwing", async () => {
    authenticate();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const actions = await import("@/actions/policy-operations");

    await expect(actions.updateProgramAssignmentOverrideFormAction(form())).resolves.toBeUndefined();
    await expect(actions.updateRenewalCheckpointWorkspaceFormAction(form())).resolves.toBeUndefined();
    await expect(actions.updateRenewalCheckpointRenewalStateFormAction(form())).resolves.toBeUndefined();
    await expect(actions.generateRenewalDecisionPacketFormAction(form())).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("[v4] updateProgramAssignmentOverrideAction", "assignmentId is required");
    expect(errorSpy).toHaveBeenCalledWith("[v4] updateRenewalCheckpointWorkspaceAction", "checkpointId is required");
    expect(errorSpy).toHaveBeenCalledWith("[v4] updateRenewalCheckpointRenewalStateAction", "checkpointId is required");
    expect(errorSpy).toHaveBeenCalledWith("[v4] generateRenewalDecisionPacketAction", "checkpointId is required");
    errorSpy.mockRestore();
  });
});
