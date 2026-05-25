import { describe, expect, it } from "vitest";
import { mapAiExtractionError, mapExtractionFailureMessage } from "@/lib/extraction/user-messages";

const HIDDEN_PRODUCT_TOKENS = [/decisions/i, /campaigns/i, /\bassurance\b/i];

describe("extraction user-visible messages (V7)", () => {
  it("mapAiExtractionError returns neutral copy without Advanced module upsell", () => {
    const samples = [
      mapAiExtractionError("rate limit exceeded"),
      mapAiExtractionError("timeout"),
      mapAiExtractionError("401 invalid api key"),
      mapAiExtractionError("unknown"),
    ];
    for (const s of samples) {
      for (const re of HIDDEN_PRODUCT_TOKENS) {
        expect(re.test(s), s).toBe(false);
      }
    }
  });

  it("mapExtractionFailureMessage does not inject product-family names for generic failures", () => {
    const s = mapExtractionFailureMessage("something went wrong");
    for (const re of HIDDEN_PRODUCT_TOKENS) {
      expect(re.test(s), s).toBe(false);
    }
  });
});
