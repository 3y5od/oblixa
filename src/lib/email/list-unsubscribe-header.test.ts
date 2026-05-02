import { describe, it, expect } from "vitest";
import { assertNoCrlfInHeaderValue, buildListUnsubscribePostBody } from "./list-unsubscribe-header";

describe("List-Unsubscribe / mail header hygiene", () => {
  it("rejects CRLF injection in header values", () => {
    expect(() => assertNoCrlfInHeaderValue("safe-value")).not.toThrow();
    expect(() => assertNoCrlfInHeaderValue("bad\r\nBcc: attacker@x")).toThrow(/crlf/i);
  });

  it("buildListUnsubscribePostBody encodes RFC8058 one-click fields", () => {
    const body = buildListUnsubscribePostBody("tok_abc");
    expect(body).toContain("List-Unsubscribe=One-Click");
    expect(body).toContain("token=tok_abc");
  });
});
