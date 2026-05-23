import { describe, expect, it } from "vitest";
import {
  isHighRiskPersistenceKey,
  persistenceRedactionApplied,
  redactForPersistence,
  redactPersistenceString,
} from "@/lib/security/persistence-redaction";

describe("persistence redaction", () => {
  it("redacts raw tokens, cookies, headers, and document text before persistence", () => {
    const out = redactForPersistence({
      action: "external.submit",
      token: "public_token_1234567890",
      headers: { authorization: "Bearer secret-token", cookie: "sid=abc" },
      raw_document_text: "Full contract text with customer@example.test",
      nested: { safe_count: 2 },
    });

    expect(out).toMatchObject({
      action: "external.submit",
      token_redacted: expect.objectContaining({ redacted: true, reason: "sensitive_persistence_key" }),
      headers_redacted: expect.objectContaining({ redacted: true, reason: "sensitive_persistence_key" }),
      raw_document_text_redacted: expect.objectContaining({ redacted: true, reason: "sensitive_persistence_key" }),
      nested: { safe_count: 2 },
    });
    expect(JSON.stringify(out)).not.toContain("public_token_1234567890");
    expect(JSON.stringify(out)).not.toContain("customer@example.test");
  });

  it("strips sensitive query params from persisted URL strings", () => {
    expect(redactPersistenceString("/callback?token=secret&tab=settings&code=abc")).toBe("/callback?tab=settings");
  });

  it("exposes a stable high-risk key predicate for static enforcement", () => {
    expect(isHighRiskPersistenceKey("authorization_header")).toBe(true);
    expect(isHighRiskPersistenceKey("document_text")).toBe(true);
    expect(isHighRiskPersistenceKey("safe_metadata")).toBe(false);
    expect(persistenceRedactionApplied({ safe: "x", token: "secret" })).toBe(true);
  });
});
