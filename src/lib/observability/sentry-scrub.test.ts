import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrub";

describe("scrubSentryEvent", () => {
  it("redacts authorization and cookie headers", () => {
    const out = scrubSentryEvent({
      message: "test",
      request: {
        headers: {
          Authorization: "Bearer secret",
          Cookie: "session=abc",
          "X-Custom": "ok",
        },
      },
    });
    expect(out.request?.headers).toEqual({
      Authorization: "[redacted]",
      Cookie: "[redacted]",
      "X-Custom": "ok",
    });
  });

  it("passes through when no request", () => {
    const e = { message: "x" };
    expect(scrubSentryEvent(e)).toBe(e);
  });

  it("redacts calibration-shaped extras (no questionnaire payloads in telemetry)", () => {
    const out = scrubSentryEvent({
      message: "wizard",
      request: { headers: {} },
      extra: {
        onboarding_answers: { primary_use_case: "x" },
        calibration_wizard_payload: { step: 1 },
        safe_meta: "ok",
      },
    });
    expect((out as { extra?: Record<string, unknown> }).extra).toEqual({
      onboarding_answers: "[redacted]",
      calibration_wizard_payload: "[redacted]",
      safe_meta: "ok",
    });
  });

  it("redacts webhook and cron-style signature headers", () => {
    const out = scrubSentryEvent({
      request: {
        headers: {
          "stripe-signature": "t=1,v1=abc",
          "x-cron-secret": "sekret",
          "x-vercel-cron-secret": "sekret",
        },
      },
    });
    expect(out.request?.headers).toEqual({
      "stripe-signature": "[redacted]",
      "x-cron-secret": "[redacted]",
      "x-vercel-cron-secret": "[redacted]",
    });
  });

  it("redacts API keys, cookies, and inbound automation tokens (case-insensitive keys)", () => {
    const out = scrubSentryEvent({
      request: {
        headers: {
          "X-Api-Key": "secret",
          "Set-Cookie": "a=b",
          "x-inbound-automation-token": "tok",
          "x-webhook-signature": "sig",
          "x-integration-token": "integration-secret",
          "x-forwarded-authorization": "Bearer x",
        },
      },
    });
    expect(out.request?.headers).toEqual({
      "X-Api-Key": "[redacted]",
      "Set-Cookie": "[redacted]",
      "x-inbound-automation-token": "[redacted]",
      "x-webhook-signature": "[redacted]",
      "x-integration-token": "[redacted]",
      "x-forwarded-authorization": "[redacted]",
    });
  });

  it("redacts additional calibration-shaped extra keys", () => {
    const out = scrubSentryEvent({
      request: { headers: {} },
      extra: {
        calibration_answers: { q: 1 },
        onboarding_calibration_json: "{}",
        calibration_questionnaire: [],
      },
    });
    expect((out as { extra?: Record<string, unknown> }).extra).toEqual({
      calibration_answers: "[redacted]",
      onboarding_calibration_json: "[redacted]",
      calibration_questionnaire: "[redacted]",
    });
  });

  it("redacts raw AI/provider message fields in extras", () => {
    const out = scrubSentryEvent({
      request: { headers: {} },
      extra: {
        rawMessage: "provider stack dump",
        raw_message: "provider stack dump",
        mappedMessage: "AI extraction failed",
      },
    });
    expect((out as { extra?: Record<string, unknown> }).extra).toEqual({
      rawMessage: "[redacted]",
      raw_message: "[redacted]",
      mappedMessage: "AI extraction failed",
    });
  });

  it("redacts email-like substrings in nested extras and user payloads", () => {
    const out = scrubSentryEvent({
      request: { headers: {}, url: "https://app.test/contracts?owner=user%40corp.test" },
      user: { email: "leak@corp.test", id: "u1" },
      extra: {
        note: "contact ops@corp.test first",
        nested: { cc: "copy@corp.test" },
      },
    });
    const extra = (out as { extra?: Record<string, unknown> }).extra;
    expect(JSON.stringify(extra)).not.toContain("@corp.test");
    expect(JSON.stringify(extra)).toContain("[redacted]");
    const user = (out as { user?: Record<string, unknown> }).user;
    expect(user?.email).toBe("[redacted]");
    const url = (out as { request?: { url?: string } }).request?.url ?? "";
    expect(url).not.toContain("@");
  });

  it("drops banlisted Sentry tag keys entirely", () => {
    const out = scrubSentryEvent({
      request: { headers: {} },
      tags: { email: "user@corp.test", route: "/api/me" },
    });
    const tags = (out as { tags?: Record<string, unknown> }).tags ?? {};
    expect(tags.email).toBeUndefined();
    expect(tags.route).toBe("/api/me");
  });

  it("redacts email-like strings in breadcrumb data", () => {
    const out = scrubSentryEvent({
      request: { headers: {} },
      breadcrumbs: [
        {
          type: "default",
          category: "ui",
          message: "opened user@corp.test",
          data: { path: "/u/user@corp.test/profile" },
        },
      ],
    });
    const crumbs = (out as { breadcrumbs?: Array<{ message?: string; data?: unknown }> }).breadcrumbs;
    expect(crumbs?.[0]?.message).not.toContain("@corp.test");
    expect(JSON.stringify(crumbs?.[0]?.data)).not.toContain("@corp.test");
  });

  it("redacts signed URLs, bearer secrets, OAuth codes, and raw text in deep payloads", () => {
    const out = scrubSentryEvent({
      message: "provider failed customer_name=AcmeCorp file_name=contract.pdf",
      request: {
        headers: { authorization: "Bearer abcdefghijk123456789" },
        url: "https://app.test/callback?code=oauthsecret123456&tab=done",
      },
      exception: {
        values: [
          {
            type: "Error",
            value: "OpenAI failed with OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH for external@example.com",
          },
        ],
      },
      extra: {
        signed_url: "https://storage.test/a?signature=private123456",
        raw_document_text: "private clause",
        safe: "actor user_1 org org_1 target contract_1 action retry result failed request req_1",
      },
      contexts: {
        provider: { access_token: "token123456789", phase: "refresh" },
      },
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain("abcdefghijk");
    expect(text).not.toContain("oauthsecret123456");
    expect(text).not.toContain("private clause");
    expect(text).not.toContain("token123456789");
    expect(text).not.toContain("AcmeCorp");
    expect(text).not.toContain("contract.pdf");
    expect(text).not.toContain("sk-proj-");
    expect(text).not.toContain("external@example.com");
    expect(text).toContain("req_1");
  });

  it("redacts signed URL values from non-sensitive request headers", () => {
    const out = scrubSentryEvent({
      request: {
        headers: {
          Referer: "https://app.test/export?token=private123456&tab=done",
          "X-Request-Id": "req_1",
        },
      },
    });
    const headers = (out as { request?: { headers?: Record<string, string> } }).request?.headers ?? {};
    expect(headers.Referer).toContain("token=[redacted]");
    expect(headers.Referer).not.toContain("private123456");
    expect(headers["X-Request-Id"]).toBe("req_1");
  });
});
