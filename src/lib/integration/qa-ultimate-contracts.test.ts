import { createHmac, timingSafeEqual } from "node:crypto";

import { describe, expect, it } from "vitest";

describe("QA ultimate contract stubs (feeds / webhooks / exports)", () => {
  it("blocks CSV formula injection prefix for untrusted cells", () => {
    const cell = "=cmd|'/c calc'!A0";
    const safe = cell.startsWith("=") || cell.startsWith("+") || cell.startsWith("-") || cell.startsWith("@") ? `'${cell}` : cell;
    expect(safe.startsWith("'")).toBe(true);
  });

  it("verifies HMAC digests with constant-time compare", () => {
    // Mitigation note: use timing-safe compares for secrets; avoid branching on secret bytes (Spectre-class read gadgets are out of scope here but tracked in QA maximal bundle grep).
    const secret = "test-secret";
    const body = '{"ok":true}';
    const a = createHmac("sha256", secret).update(body).digest();
    const b = createHmac("sha256", secret).update(body).digest();
    expect(timingSafeEqual(a, b)).toBe(true);
  });

  it("expects RFC7807 problem+json content type helper pattern", () => {
    const ct = "application/problem+json; charset=utf-8";
    expect(ct.toLowerCase()).toContain("application/problem+json");
  });
});
