import { describe, expect, it } from "vitest";
import { declineRemediation } from "@/lib/billing/decline-codes";

// SPEC: docs/billing-page-refinement-pass.md §14.15 — decline-code
// remediation mapping.

describe("declineRemediation", () => {
  it("returns specific copy for insufficient_funds", () => {
    expect(declineRemediation("insufficient_funds")).toContain("balance");
  });

  it("returns specific copy for expired_card", () => {
    expect(declineRemediation("expired_card")).toContain("expired");
  });

  it("returns specific copy for incorrect_cvc", () => {
    expect(declineRemediation("incorrect_cvc")).toContain("security code");
  });

  it("returns specific copy for card_declined", () => {
    expect(declineRemediation("card_declined")).toContain("card issuer");
  });

  it("returns specific copy for processing_error", () => {
    expect(declineRemediation("processing_error")).toContain("Retry");
  });

  it("returns default copy for unknown codes", () => {
    expect(declineRemediation("some_unmapped_code")).toContain(
      "Contact support"
    );
  });

  it("returns default copy for null/undefined", () => {
    expect(declineRemediation(null)).toContain("Contact support");
    expect(declineRemediation(undefined)).toContain("Contact support");
  });
});
