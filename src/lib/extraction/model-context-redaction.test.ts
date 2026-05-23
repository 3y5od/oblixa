import { describe, expect, it } from "vitest";
import {
  MODEL_CONTEXT_REDACTION_REPLACEMENT,
  prepareModelBoundContractText,
  redactModelBoundContractText,
} from "@/lib/extraction/model-context-redaction";
import { buildUserPrompt } from "@/lib/extraction/extract-fields";

describe("model-bound extraction context redaction", () => {
  it("redacts provider tokens, cookies, private URLs, and unrelated org ids", () => {
    const text = [
      "Counterparty: Acme Corp",
      "Authorization: Bearer abcdefghijk123456789",
      "Cookie: session=private-session-value",
      "api_key=sk_live_1234567890abcdef",
      "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
      "github_token=gho_abcdefghijklmnopqrstuvwxyz",
      "private_url=https://storage.example.test/files/a.pdf?token=secretvalue123456&safe=1",
      "gcs_url=https://storage.googleapis.test/a?X-Goog-Signature=googsecret123456&GoogleAccessId=account@example.test",
      "Public label with signed link https://cdn.example.test/a?token=unlabeledsecret123456&safe=1",
      "organization_id=org_unrelated999",
      "tenant_alpha12345",
    ].join("\n");

    const out = redactModelBoundContractText(text);
    expect(out).toContain("Counterparty: Acme Corp");
    expect(out).toContain(`Authorization: ${MODEL_CONTEXT_REDACTION_REPLACEMENT}`);
    expect(out).toContain(`Cookie: ${MODEL_CONTEXT_REDACTION_REPLACEMENT}`);
    expect(out).toContain(`api_key=${MODEL_CONTEXT_REDACTION_REPLACEMENT}`);
    expect(out).toContain(`token=${MODEL_CONTEXT_REDACTION_REPLACEMENT}`);
    expect(out).toContain(`organization_id=${MODEL_CONTEXT_REDACTION_REPLACEMENT}`);
    expect(out).not.toContain("abcdefghijk123456789");
    expect(out).not.toContain("private-session-value");
    expect(out).not.toContain("sk_live_1234567890abcdef");
    expect(out).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890");
    expect(out).not.toContain("gho_abcdefghijklmnopqrstuvwxyz");
    expect(out).not.toContain("secretvalue123456");
    expect(out).not.toContain("googsecret123456");
    expect(out).not.toContain("account@example.test");
    expect(out).not.toContain("unlabeledsecret123456");
    expect(out).not.toContain("org_unrelated999");
    expect(out).not.toContain("tenant_alpha12345");
  });

  it("constructs prompts without sensitive fields present", () => {
    const prompt = buildUserPrompt(
      [
        "Counterparty: Acme Corp",
        "client_secret=supersecretvalue",
        "Set-Cookie: app_session=abcdef123456789",
        "Signed link: https://files.example.test/a?X-Amz-Signature=abcdef123456789",
      ].join("\n")
    );

    expect(prompt).toContain("Counterparty: Acme Corp");
    expect(prompt).toContain(MODEL_CONTEXT_REDACTION_REPLACEMENT);
    expect(prompt).not.toContain("supersecretvalue");
    expect(prompt).not.toContain("abcdef123456789");
  });

  it("normalizes and redacts before chunking model-bound text", () => {
    const out = prepareModelBoundContractText("Counterparty:\tAcme\r\naccess_token=tokensecret123456789");
    expect(out).toBe(`Counterparty: Acme\naccess_token=${MODEL_CONTEXT_REDACTION_REPLACEMENT}`);
  });
});
