import { describe, expect, it } from "vitest";
import {
  redactOutboundMessageText,
  sanitizeOutboundHtml,
  scrubOutboundPayloadValue,
} from "./outbound-payload-scrub";

describe("outbound-payload-scrub", () => {
  it("redacts API keys, bearer tokens, cookies, signed URLs, and JWTs in text", () => {
    const out = redactOutboundMessageText(
      "Bearer abcdefghijk Cookie: session=secret; url=https://files.test/a.pdf?token=abc&signature=def jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghi"
    );
    expect(out).toContain("Bearer [redacted]");
    expect(out).toContain("Cookie=[redacted]");
    expect(out).toContain("token=[redacted]");
    expect(out).toContain("signature=[redacted]");
    expect(out).toContain("[redacted_jwt]");
  });

  it("redacts sensitive keys recursively while preserving safe metadata shape", () => {
    const out = scrubOutboundPayloadValue({
      schema_version: "v2",
      contract_id: "contract-1",
      access_token: "secret-token",
      nested: {
        private_url: "https://files.test/private.pdf?token=abc",
        label: "Status changed",
      },
    }) as Record<string, unknown>;
    expect(out.schema_version).toBe("v2");
    expect(out.contract_id).toBe("contract-1");
    expect(out.access_token).toBe("[redacted]");
    expect(out.nested).toMatchObject({
      private_url: "[redacted]",
      label: "Status changed",
    });
  });

  it("removes active HTML content and dangerous URL schemes", () => {
    const out = sanitizeOutboundHtml(
      '<p onclick="steal()">ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="data:text/html,<svg>">'
    );
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("onclick=");
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out.toLowerCase()).not.toContain("data:text/html");
    expect(out).toContain('href="#"');
    expect(out).toContain('src="#"');
  });
});
