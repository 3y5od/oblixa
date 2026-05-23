import { describe, expect, it } from "vitest";
import { sanitizeDiscordEmbedSnippet } from "./discord-embed-snippet-sanitize";

describe("sanitizeDiscordEmbedSnippet", () => {
  it("defangs @everyone", () => {
    expect(sanitizeDiscordEmbedSnippet('{"description":"ping @everyone"}')).not.toContain("@everyone");
  });

  it("breaks active content URL and script tokens", () => {
    const out = sanitizeDiscordEmbedSnippet('{"description":"<script>x</script>","url":"javascript:alert(1)","image":"data:text/html,<svg>","footer":"vbscript:msgbox(1)"}');
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("</script");
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out.toLowerCase()).not.toContain("data:text/html");
    expect(out.toLowerCase()).not.toContain("vbscript:");
  });

  it("redacts token-shaped values in embed text", () => {
    const out = sanitizeDiscordEmbedSnippet('{"description":"Bearer discord-secret-token","url":"https://files.test/a.pdf?token=abc"}');
    expect(out).toContain("Bearer [redacted]");
    expect(out).toContain("token=[redacted]");
    expect(out).not.toContain("discord-secret-token");
  });
});
