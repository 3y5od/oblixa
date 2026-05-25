import { describe, expect, it } from "vitest";
import { EXTERNAL_ACTION_TYPES } from "@/lib/decision-intelligence/external-action-types";
import { validateExternalActionPayload } from "@/lib/decision-intelligence/external-action-payload";

describe("validateExternalActionPayload", () => {
  it("covers every ExternalActionType without falling through to unsupported", () => {
    for (const t of EXTERNAL_ACTION_TYPES) {
      const r = validateExternalActionPayload(t, {});
      expect(r.ok === true || r.ok === false).toBe(true);
      if (!r.ok) {
        expect(typeof r.error).toBe("string");
        expect(r.error).not.toMatch(/Unsupported action type/);
      }
    }
  });

  it("submit_evidence: requires message, notes, or evidenceReference", () => {
    expect(validateExternalActionPayload("submit_evidence", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("submit_evidence", { message: "hi" }).ok
    ).toBe(true);
    expect(
      validateExternalActionPayload("submit_evidence", { notes: "n" }).ok
    ).toBe(true);
    expect(
      validateExternalActionPayload("submit_evidence", { evidenceReference: "ref" }).ok
    ).toBe(true);
  });

  it("acknowledge_receipt: acknowledged must be boolean true", () => {
    expect(validateExternalActionPayload("acknowledge_receipt", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("acknowledge_receipt", { acknowledged: "true" as unknown as boolean })
        .ok
    ).toBe(false);
    expect(
      validateExternalActionPayload("acknowledge_receipt", { acknowledged: true }).ok
    ).toBe(true);
  });

  it("structured_request_response: non-empty response", () => {
    expect(validateExternalActionPayload("structured_request_response", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("structured_request_response", { response: "ok" }).ok
    ).toBe(true);
  });

  it("confirm_renewal_input: confirmed true", () => {
    expect(validateExternalActionPayload("confirm_renewal_input", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("confirm_renewal_input", { confirmed: true }).ok
    ).toBe(true);
  });

  it("upload_requested_document: at least one of documentDescription or fileName", () => {
    expect(validateExternalActionPayload("upload_requested_document", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("upload_requested_document", { fileName: "a.pdf" }).ok
    ).toBe(true);
  });

  it("confirm_notice_delivery: delivered true", () => {
    expect(validateExternalActionPayload("confirm_notice_delivery", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("confirm_notice_delivery", { delivered: true }).ok
    ).toBe(true);
  });

  it("amendment_intake_response: summary required", () => {
    expect(validateExternalActionPayload("amendment_intake_response", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("amendment_intake_response", { summary: "s" }).ok
    ).toBe(true);
  });

  it("complete_attestation: statement or attestationReference", () => {
    expect(validateExternalActionPayload("complete_attestation", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("complete_attestation", { statement: "x" }).ok
    ).toBe(true);
  });

  it("review_decision_packet: reviewed true", () => {
    expect(validateExternalActionPayload("review_decision_packet", {}).ok).toBe(false);
    expect(
      validateExternalActionPayload("review_decision_packet", { reviewed: true }).ok
    ).toBe(true);
  });

  it("coerces non-string fields via toSafeString", () => {
    const r = validateExternalActionPayload("structured_request_response", {
      response: 42 as unknown as string,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized.response).toBe("42");
  });
});
