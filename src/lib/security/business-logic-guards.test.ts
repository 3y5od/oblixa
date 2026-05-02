import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/security/validation";

/**
 * Lightweight regression anchors for abuse-class invariants shared by server actions.
 * (Seat caps, coupon integrity, and approval TOCTOU live with domain modules — this file
 * keeps CI-visible tests for cross-cutting UUID/org validation helpers.)
 */
describe("business-logic guard helpers", () => {
  it("rejects non-UUID org identifiers used in org-scoped actions", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
  });
});
