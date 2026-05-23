import { describe, expect, it } from "vitest";
import { serializeJsonLdForInlineScript } from "@/lib/security/json-ld-inline-script";

describe("serializeJsonLdForInlineScript", () => {
  it("round-trips plain objects", () => {
    const input = { a: 1, b: "hello" };
    expect(JSON.parse(serializeJsonLdForInlineScript(input))).toEqual(input);
  });

  it("does not emit raw </script> inside string values", () => {
    const malicious = { text: "</script><script>alert(1)</script>" };
    const out = serializeJsonLdForInlineScript(malicious);
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
    expect(JSON.parse(out)).toEqual(malicious);
  });

  it("escapes user-controlled names and titles with script tags", () => {
    const malicious = {
      name: "Acme <script>alert(1)</script>",
      title: "Contract </script><img src=x onerror=alert(1)>",
    };
    const out = serializeJsonLdForInlineScript(malicious);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("</script");
    expect(out).not.toContain("<img");
    expect(JSON.parse(out)).toEqual(malicious);
  });

  it("escapes angle brackets in nested strings", () => {
    const input = { nested: { x: "<foo>" } };
    const out = serializeJsonLdForInlineScript(input);
    expect(out).not.toMatch(/<foo>/);
    expect(JSON.parse(out)).toEqual(input);
  });
});
