import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const createClient = vi.fn(async () => ({
  auth: { getUser },
}));
const createAdminClient = vi.fn(async () => ({ from }));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

vi.mock("@/actions/tasks", () => ({
  autoTransitionTasksForField: vi.fn(),
}));

const VALID_CONTRACT_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ORG_ID = "550e8400-e29b-41d4-a716-446655440010";
const VALID_OWNER_ID = "550e8400-e29b-41d4-a716-446655440020";
const VALID_FIELD_ID = "550e8400-e29b-41d4-a716-446655440030";
const VALID_FILE_ID = "550e8400-e29b-41d4-a716-446655440040";
const VALID_CHECKLIST_ID = "550e8400-e29b-41d4-a716-446655440050";

describe("contract actions (auth / validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function authenticate() {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  }

  function contractForm(overrides: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("organizationId", VALID_ORG_ID);
    fd.set("title", "Master Services Agreement");
    for (const [key, value] of Object.entries(overrides)) {
      fd.set(key, value);
    }
    return fd;
  }

  it("returns not authenticated without a user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { deleteContract } = await import("@/actions/contracts");
    const res = await deleteContract(VALID_CONTRACT_ID);
    expect(res).toEqual({ error: "Not authenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns invalid contract for non-uuid ids", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { deleteContract } = await import("@/actions/contracts");
    const res = await deleteContract("not-a-uuid");
    expect(res).toEqual({ error: "Invalid contract" });
    expect(from).not.toHaveBeenCalled();
  });

  it("createContract rejects unsafe titles before auth or membership lookup", async () => {
    const { createContract } = await import("@/actions/contracts");
    const fd = new FormData();
    fd.set("organizationId", VALID_ORG_ID);
    fd.set("title", "MSA\u202Ehidden");
    const res = await createContract(fd);
    expect(res).toEqual({ error: "Title contains unsupported characters" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["missing title", { title: "" }, "Title is required"],
    ["missing organization", { organizationId: "" }, "Organization is required"],
    ["invalid organization", { organizationId: "bad-org" }, "Invalid organization"],
    ["long counterparty", { counterparty: "x".repeat(501) }, "Counterparty is too long"],
    ["long contract type", { contractType: "x".repeat(121) }, "Contract type is too long"],
    ["long source system", { sourceSystem: "x".repeat(81) }, "Source system is too long"],
    ["long region", { region: "x".repeat(41) }, "Region is too long"],
    ["long external reference", { externalReferenceId: "x".repeat(161) }, "External reference is too long"],
    ["long annual value", { annualValue: "1".repeat(41) }, "Annual value must be a valid positive number."],
    ["negative annual value", { annualValue: "-1" }, "Annual value must be a valid positive number."],
    ["too large annual value", { annualValue: "1000000000000" }, "Annual value must be a valid positive number."],
  ])("createContract rejects %s before auth or membership lookup", async (_name, overrides, error) => {
    const { createContract } = await import("@/actions/contracts");
    const res = await createContract(contractForm(overrides));
    expect(res).toEqual({ error });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("createContract rejects unauthenticated users after field validation", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { createContract } = await import("@/actions/contracts");
    const res = await createContract(contractForm());
    expect(res).toEqual({ error: "Not authenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    [
      "updateContractField unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractField(VALID_FIELD_ID, "approved"),
      "Not authenticated",
    ],
    [
      "updateContractSecondaryOwner unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractSecondaryOwner(VALID_CONTRACT_ID, VALID_OWNER_ID),
      "Not authenticated",
    ],
    [
      "updateContractHandoffChecklistStatus unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractHandoffChecklistStatus(VALID_CHECKLIST_ID, "completed"),
      "Invalid request",
    ],
    [
      "uploadAdditionalFiles unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.uploadAdditionalFiles(VALID_CONTRACT_ID, new FormData()),
      "Not authenticated",
    ],
    [
      "supersedeContractFile unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.supersedeContractFile({ contractId: VALID_CONTRACT_ID, fileId: VALID_FILE_ID }),
      "Not authenticated",
    ],
    [
      "runExtraction unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) => contracts.runExtraction(VALID_CONTRACT_ID),
      "Not authenticated",
    ],
    [
      "batchApproveReadyFields unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) => contracts.batchApproveReadyFields(VALID_CONTRACT_ID),
      "Not authenticated",
    ],
    [
      "bulkCreateContractsFromFiles unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) => contracts.bulkCreateContractsFromFiles(contractForm()),
      "Not authenticated",
    ],
    [
      "updateContractOwner unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractOwner(VALID_CONTRACT_ID, VALID_OWNER_ID),
      "Not authenticated",
    ],
    [
      "bulkAssignContractOwners unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) => {
        const fd = new FormData();
        fd.set("contractIds", VALID_CONTRACT_ID);
        fd.set("newOwnerId", VALID_OWNER_ID);
        return contracts.bulkAssignContractOwners(fd);
      },
      "Not authenticated",
    ],
    [
      "getFileDownloadUrl unauthenticated",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.getFileDownloadUrl(`${VALID_ORG_ID}/${VALID_CONTRACT_ID}/contract.pdf`),
      "Not authenticated",
    ],
  ])("%s rejects missing users before writes", async (_name, callAction, error) => {
    getUser.mockResolvedValue({ data: { user: null } });
    const contracts = await import("@/actions/contracts");
    const res = await callAction(contracts);
    expect(res).toMatchObject({ error });
  });

  it.each([
    [
      "updateContractField invalid id",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractField("bad-field", "approved"),
      "Invalid field",
    ],
    [
      "updateContractSecondaryOwner invalid contract",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractSecondaryOwner("bad-contract", VALID_OWNER_ID),
      "Invalid contract",
    ],
    [
      "updateContractSecondaryOwner invalid secondary owner",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractSecondaryOwner(VALID_CONTRACT_ID, "bad-owner"),
      "Invalid secondary owner",
    ],
    [
      "upsertContractHandoffChecklist invalid identifiers",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.upsertContractHandoffChecklist({
          contractId: "bad-contract",
          toOwnerId: VALID_OWNER_ID,
          checklistNote: "Ready",
        }),
      "Invalid request",
    ],
    [
      "upsertContractHandoffChecklist blank note",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.upsertContractHandoffChecklist({
          contractId: VALID_CONTRACT_ID,
          toOwnerId: VALID_OWNER_ID,
          checklistNote: "  ",
        }),
      "Checklist note is required",
    ],
    [
      "updateContractHandoffChecklistStatus invalid id",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractHandoffChecklistStatus("bad-checklist", "completed"),
      "Invalid request",
    ],
    [
      "addManualField invalid contract",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.addManualField("bad-contract", "end_date", "2026-01-01"),
      "Invalid contract",
    ],
    [
      "addManualField invalid field",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.addManualField(VALID_CONTRACT_ID, "unknown_field", "value"),
      "Invalid field name",
    ],
    [
      "uploadAdditionalFiles invalid contract",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.uploadAdditionalFiles("bad-contract", new FormData()),
      "Invalid contract",
    ],
    [
      "supersedeContractFile invalid request",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.supersedeContractFile({ contractId: "bad-contract", fileId: VALID_FILE_ID }),
      "Invalid request",
    ],
    [
      "supersedeContractFile invalid replacement",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.supersedeContractFile({
          contractId: VALID_CONTRACT_ID,
          fileId: VALID_FILE_ID,
          replacementFileId: "bad-replacement",
        }),
      "Invalid replacement file",
    ],
    [
      "runExtraction invalid contract",
      async (contracts: typeof import("@/actions/contracts")) => contracts.runExtraction("bad-contract"),
      "Invalid contract",
    ],
    [
      "batchApproveReadyFields invalid contract",
      async (contracts: typeof import("@/actions/contracts")) => contracts.batchApproveReadyFields("bad-contract"),
      "Invalid contract",
    ],
    [
      "bulkCreateContractsFromFiles missing org",
      async (contracts: typeof import("@/actions/contracts")) => contracts.bulkCreateContractsFromFiles(new FormData()),
      "Organization is required",
    ],
    [
      "bulkCreateContractsFromFiles invalid org",
      async (contracts: typeof import("@/actions/contracts")) => {
        const fd = new FormData();
        fd.set("organizationId", "bad-org");
        return contracts.bulkCreateContractsFromFiles(fd);
      },
      "Invalid organization",
    ],
    [
      "updateContractOwner invalid request",
      async (contracts: typeof import("@/actions/contracts")) =>
        contracts.updateContractOwner("bad-contract", VALID_OWNER_ID),
      "Invalid request",
    ],
    [
      "bulkAssignContractOwners invalid owner",
      async (contracts: typeof import("@/actions/contracts")) => {
        const fd = new FormData();
        fd.set("contractIds", VALID_CONTRACT_ID);
        fd.set("newOwnerId", "bad-owner");
        return contracts.bulkAssignContractOwners(fd);
      },
      "Select a valid owner",
    ],
    [
      "bulkAssignContractOwners no selected contracts",
      async (contracts: typeof import("@/actions/contracts")) => {
        const fd = new FormData();
        fd.set("contractIds", "bad-contract");
        fd.set("newOwnerId", VALID_OWNER_ID);
        return contracts.bulkAssignContractOwners(fd);
      },
      "No contracts selected",
    ],
    [
      "getFileDownloadUrl invalid path",
      async (contracts: typeof import("@/actions/contracts")) => contracts.getFileDownloadUrl("../secret.txt"),
      "Invalid file path",
    ],
  ])("%s fails closed before database mutation", async (_name, callAction, error) => {
    authenticate();
    const contracts = await import("@/actions/contracts");
    const res = await callAction(contracts);
    expect(res).toMatchObject({ error });
  });

  it("upsertContractHandoffChecklist rejects unsafe notes before auth or contract lookup", async () => {
    const { upsertContractHandoffChecklist } = await import("@/actions/contracts");
    const res = await upsertContractHandoffChecklist({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      toOwnerId: "550e8400-e29b-41d4-a716-446655440001",
      checklistNote: "handoff\u202Ehidden",
    });
    expect(res).toEqual({ error: "Checklist note contains unsupported characters" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("addManualField rejects unsafe values before auth or contract lookup", async () => {
    const { addManualField } = await import("@/actions/contracts");
    const res = await addManualField("550e8400-e29b-41d4-a716-446655440000", "end_date", "2026-01-01\u202E");
    expect(res).toEqual({ error: "Value contains unsupported characters" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("supersedeContractFile rejects unsafe reasons before auth or contract lookup", async () => {
    const { supersedeContractFile } = await import("@/actions/contracts");
    const res = await supersedeContractFile({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      fileId: "550e8400-e29b-41d4-a716-446655440001",
      reason: "replacement\u202Ehidden",
    });
    expect(res).toEqual({ error: "Reason contains unsupported characters" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("updateContractOperationalState rejects unsafe next steps before auth or contract lookup", async () => {
    const { updateContractOperationalState } = await import("@/actions/contracts-lifecycle");
    const res = await updateContractOperationalState({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      intakeStatus: "in_clarification",
      healthStatus: "watch",
      requiredNextStep: "confirm owner\u202Ehidden",
    });
    expect(res).toEqual({ error: "Required next step contains unsupported characters" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("upsertContractIntakeRequest rejects unsafe JSON keys before auth or writes", async () => {
    const { upsertContractIntakeRequest } = await import("@/actions/contracts-lifecycle");
    const res = await upsertContractIntakeRequest({
      status: "new",
      payload: { constructor: { polluted: true } },
    });
    expect(res).toEqual({ error: "Intake payload contains unsupported keys" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("updateContractExternalLink rejects unsafe external references before auth or contract lookup", async () => {
    const { updateContractExternalLink } = await import("@/actions/contracts-lifecycle");
    const res = await updateContractExternalLink({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      externalReferenceId: "crm-123\u202Ehidden",
    });
    expect(res).toEqual({ error: "External reference contains unsupported characters" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
