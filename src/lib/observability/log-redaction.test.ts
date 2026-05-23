import { describe, expect, it } from "vitest";
import {
  deepRedactEmailLikeInUnknown,
  formatUnknownForServerLog,
  redactEmailLikeSubstrings,
  redactSensitiveHeaders,
  redactSensitiveLogString,
} from "./log-redaction";

describe("log-redaction", () => {
  it("redacts email-like substrings", () => {
    expect(redactEmailLikeSubstrings("ping ops@corp.test now")).toBe("ping [redacted] now");
  });

  it("formats unknown server log values without dumping huge payloads verbatim", () => {
    const s = formatUnknownForServerLog({ nested: "x".repeat(5000) });
    expect(s.length).toBeLessThan(4500);
    expect(s).toContain("…");
  });

  it("deep-redacts nested structures", () => {
    const out = deepRedactEmailLikeInUnknown({ a: ["ok", "bad@corp.test"] });
    expect(JSON.stringify(out)).not.toContain("@corp.test");
  });

  it("redacts tokens, signed URL secrets, API keys, and raw payload keys", () => {
    expect(redactSensitiveLogString("Authorization: Bearer abcdefghijk123456789")).not.toContain("abcdefghijk");
    expect(redactSensitiveLogString("OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH")).not.toContain("sk-proj-");
    expect(redactSensitiveLogString(`OPENAI_API_KEY=${"sk-" + "A".repeat(48)}`)).not.toContain("sk-");
    expect(redactSensitiveLogString("github_token=gho_abcdefghijklmnopqrstuvwxyz123456")).not.toContain("gho_");
    expect(redactSensitiveLogString("customer_name=AcmeCorp file_name=contract.pdf raw_text=private-clause")).toBe(
      "customer_name=[redacted] file_name=[redacted] raw_text=[redacted]"
    );
    expect(redactSensitiveLogString("https://x.test/file?token=secretvalue123&tab=audit")).toContain("token=[redacted]");
    expect(redactSensitiveLogString("https://x.test/file?X-Goog-Signature=secretvalue123&tab=audit")).toContain(
      "X-Goog-Signature=[redacted]"
    );
    const out = deepRedactEmailLikeInUnknown({
      access_token: "secret-token",
      nested: { raw_document_text: "private clause", provider_payload: { x: 1 } },
      safe: "actor user_1 org org_1 action retry result failed request req_1",
    });
    expect(out).toEqual({
      access_token: "[redacted]",
      nested: { raw_document_text: "[redacted]", provider_payload: "[redacted]" },
      safe: "actor user_1 org org_1 action retry result failed request req_1",
    });
  });

  it("formats route and job errors without secret material", () => {
    const formatted = formatUnknownForServerLog({
      error_class: "provider_error",
      request_id: "req_1",
      api_key: "sk_live_1234567890",
      signed_url: "https://storage.test/a?signature=abcdef123456",
    });
    expect(formatted).toContain("provider_error");
    expect(formatted).toContain("req_1");
    expect(formatted).not.toContain("sk_live_");
    expect(formatted).not.toContain("abcdef123456");
  });

  it("redacts header-shaped objects with centralized sensitive header names", () => {
    const out = redactSensitiveHeaders({
      Authorization: "Bearer abcdefghijk123456789",
      "x-api-key": "sk_live_1234567890",
      "x-request-id": "req_1",
      Referer: "https://app.test/export?token=private123456&tab=done",
    });
    expect(out.Authorization).toBe("[redacted]");
    expect(out["x-api-key"]).toBe("[redacted]");
    expect(out["x-request-id"]).toBe("req_1");
    expect(out.Referer).toContain("token=[redacted]");
    expect(out.Referer).not.toContain("private123456");
  });

  it("redacts provider response and customer metadata keys", () => {
    const out = deepRedactEmailLikeInUnknown({
      provider_response: { raw: "private" },
      customer_email: "external@example.com",
      safe: { request_id: "req_1" },
    });
    expect(out).toEqual({
      provider_response: "[redacted]",
      customer_email: "[redacted]",
      safe: { request_id: "req_1" },
    });
  });

  it("redacts PostgREST-shaped errors without logging query details or user content", () => {
    const formatted = formatUnknownForServerLog({
      code: "23505",
      message: "duplicate key value violates unique constraint users_email_key",
      details: "Key (email)=(external@example.com) already exists.",
      hint: "SELECT * FROM private_table WHERE raw_contract_text = 'private clause'",
    });
    expect(formatted).toContain('"code":"23505"');
    expect(formatted).not.toContain("external@example.com");
    expect(formatted).not.toContain("private_table");
    expect(formatted).not.toContain("private clause");
    expect(formatted).toContain('"details":"[redacted]"');
    expect(formatted).toContain('"hint":"[redacted]"');
  });
});
