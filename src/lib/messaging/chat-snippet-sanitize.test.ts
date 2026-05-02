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

  it("defangs javascript inside markdown href", () => {
    expect(sanitizeChatSnippet("[label](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("defangs Slack-style auto-link openers", () => {
    expect(sanitizeChatSnippet("see <https://evil.test|nice>")).not.toContain("<https://");
  });
});
