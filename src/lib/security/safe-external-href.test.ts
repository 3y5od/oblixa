import { describe, expect, it } from "vitest";
import { externalLinkRelAndReferrer, sanitizeExternalHref } from "./safe-external-href";

describe("sanitizeExternalHref", () => {
  it("blocks javascript and data URLs", () => {
    expect(sanitizeExternalHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeExternalHref(" javaScript :alert(1)")).toBeNull();
    expect(sanitizeExternalHref("java\nscript:alert(1)")).toBeNull();
    expect(sanitizeExternalHref("data:text/html,<script>")).toBeNull();
    expect(sanitizeExternalHref("vbscript:msgbox(1)")).toBeNull();
    expect(sanitizeExternalHref("file:///etc/passwd")).toBeNull();
  });

  it("allows https and relative paths", () => {
    expect(sanitizeExternalHref("https://example.com/x")).toBe("https://example.com/x");
    expect(sanitizeExternalHref("http://example.com/x")).toBe("http://example.com/x");
    expect(sanitizeExternalHref("/contracts/1")).toBe("/contracts/1");
  });

  it("rejects control characters and protocol-relative URLs", () => {
    expect(sanitizeExternalHref("https://exa\nmple.com/x")).toBeNull();
    expect(sanitizeExternalHref("/contracts/\u00001")).toBeNull();
    expect(sanitizeExternalHref("https://example.com/\u007f")).toBeNull();
    expect(sanitizeExternalHref("//evil.example/path")).toBeNull();
  });

  it("allows hash-only anchors", () => {
    expect(sanitizeExternalHref("#section")).toBe("#section");
  });

  it("rejects empty and unknown schemes", () => {
    expect(sanitizeExternalHref("")).toBeNull();
    expect(sanitizeExternalHref("   ")).toBeNull();
    expect(sanitizeExternalHref("ftp://example.com")).toBeNull();
  });

  it("strips mailto when policy is strip", () => {
    expect(sanitizeExternalHref("mailto:a@b.com", "strip")).toBeNull();
    expect(sanitizeExternalHref("mailto:a@b.com", "allow")).toBe("mailto:a@b.com");
  });

  it("strips tel, sms, intent when policy is strip", () => {
    expect(sanitizeExternalHref("tel:+15551234567", "strip")).toBeNull();
    expect(sanitizeExternalHref("sms:+15551234567", "strip")).toBeNull();
    expect(sanitizeExternalHref("intent://scan#Intent;end", "strip")).toBeNull();
  });

  it("allows tel, sms, intent when policy is allow", () => {
    expect(sanitizeExternalHref("tel:+15551234567", "allow")).toBe("tel:+15551234567");
    expect(sanitizeExternalHref("SMS:+15551234567", "allow")).toBe("SMS:+15551234567");
    expect(sanitizeExternalHref("intent://host#Intent;end", "allow")).toBe("intent://host#Intent;end");
  });
});

describe("externalLinkRelAndReferrer", () => {
  it("returns hardened rel and referrer policy", () => {
    expect(externalLinkRelAndReferrer()).toEqual({
      rel: "noopener noreferrer",
      referrerPolicy: "no-referrer",
    });
  });
});
