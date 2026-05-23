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

describe("contract actions (auth / validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns not authenticated without a user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { deleteContract } = await import("@/actions/contracts");
    const res = await deleteContract("550e8400-e29b-41d4-a716-446655440000");
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
    fd.set("organizationId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("title", "MSA\u202Ehidden");
    const res = await createContract(fd);
    expect(res).toEqual({ error: "Title contains unsupported characters" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
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
