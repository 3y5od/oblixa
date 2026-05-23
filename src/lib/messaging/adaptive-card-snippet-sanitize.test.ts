import { describe, expect, it } from "vitest";
import { sanitizeAdaptiveCardSnippet } from "./adaptive-card-snippet-sanitize";

describe("sanitizeAdaptiveCardSnippet", () => {
  it("defangs @everyone in card payload text", () => {
    expect(sanitizeAdaptiveCardSnippet('{"text":"hi @everyone"}')).not.toContain("@everyone");
  });

  it("breaks javascript: in embedded URLs", () => {
    expect(sanitizeAdaptiveCardSnippet('{"url":"javascript:alert(1)"}')).not.toContain("javascript:");
  });

  it("breaks script tags and HTML data URLs", () => {
    const out = sanitizeAdaptiveCardSnippet('{"text":"<script>x</script>","url":"data:text/html,<b>x</b>","fallback":"vbscript:msgbox(1)"}');
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("</script");
    expect(out.toLowerCase()).not.toContain("data:text/html");
    expect(out.toLowerCase()).not.toContain("vbscript:");
  });

  it("redacts bearer tokens and signed URLs in card text", () => {
    const out = sanitizeAdaptiveCardSnippet('{"text":"Bearer card-secret-token","url":"https://files.test/a.pdf?token=abc"}');
    expect(out).toContain("Bearer [redacted]");
    expect(out).toContain("token=[redacted]");
    expect(out).not.toContain("card-secret-token");
  });
});
