import fc from "fast-check";
import { describe, it } from "vitest";
import { validateExternalActionPayload } from "@/lib/decision-intelligence/external-action-payload";

describe("external-action-payload (fast-check)", () => {
  it("submit_evidence accepts any non-empty message string", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 400 }).filter((s) => s.trim().length > 0),
        (message) => {
          const r = validateExternalActionPayload("submit_evidence", { message });
          const trimmed = message.trim();
          return (
            r.ok === true &&
            "normalized" in r &&
            (r.normalized as { message?: string }).message === trimmed
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it("acknowledge_receipt requires acknowledged true", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.string({ maxLength: 80 }), (ack, reference) => {
        const r = validateExternalActionPayload("acknowledge_receipt", {
          acknowledged: ack,
          reference,
        });
        if (ack !== true) return r.ok === false;
        return r.ok === true;
      }),
      { numRuns: 40 }
    );
  });
});
