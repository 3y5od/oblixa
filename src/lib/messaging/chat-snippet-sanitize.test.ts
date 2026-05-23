import { describe, it, expect } from "vitest";
import { sanitizeChatSnippet } from "./chat-snippet-sanitize";

describe("sanitizeChatSnippet", () => {
  it("defangs mass mention tokens", () => {
    expect(sanitizeChatSnippet("hello @everyone")).not.toContain("@everyone");
    expect(sanitizeChatSnippet("@channel update")).not.toContain("@channel");
  });

  it("breaks javascript: URL prefix", () => {
    expect(sanitizeChatSnippet("click javascript:alert(1)")).not.toContain("javascript:");
  });

  it("breaks script tags and HTML data URLs", () => {
    const out = sanitizeChatSnippet('<script>alert(1)</script> data:text/html,<svg onload=alert(1)> vbscript:msgbox(1)');
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("</script");
    expect(out.toLowerCase()).not.toContain("data:text/html");
    expect(out.toLowerCase()).not.toContain("vbscript:");
  });

  it("defangs javascript inside markdown href", () => {
    expect(sanitizeChatSnippet("[label](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("defangs Slack-style auto-link openers", () => {
    expect(sanitizeChatSnippet("see <https://evil.test|nice>")).not.toContain("<https://");
  });

  it("redacts bearer tokens and signed URL query values", () => {
    const out = sanitizeChatSnippet("Bearer secret-token-123 see https://files.test/a.pdf?token=abc&signature=def");
    expect(out).toContain("Bearer [redacted]");
    expect(out).toContain("token=[redacted]");
    expect(out).toContain("signature=[redacted]");
    expect(out).not.toContain("secret-token-123");
  });
});
