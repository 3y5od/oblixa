import { describe, expect, it } from "vitest";
import { sanitizeAdaptiveCardSnippet } from "./adaptive-card-snippet-sanitize";

describe("sanitizeAdaptiveCardSnippet", () => {
  it("defangs @everyone in card payload text", () => {
    expect(sanitizeAdaptiveCardSnippet('{"text":"hi @everyone"}')).not.toContain("@everyone");
  });

  it("breaks javascript: in embedded URLs", () => {
    expect(sanitizeAdaptiveCardSnippet('{"url":"javascript:alert(1)"}')).not.toContain("javascript:");
  });
});
