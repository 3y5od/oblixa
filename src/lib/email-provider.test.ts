import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const safeFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch: safeFetchMock,
}));

describe("sendReminderEmail without provider", () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevFrom = process.env.EMAIL_FROM;

  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  beforeEach(() => {
    vi.resetModules();
    safeFetchMock.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    restoreEnv("RESEND_API_KEY", prevKey);
    restoreEnv("EMAIL_FROM", prevFrom);
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns a clear error when Resend is not configured", async () => {
    const { sendReminderEmail } = await import("@/lib/email");
    const out = await sendReminderEmail({
      to: "a@b.co",
      contractTitle: "C",
      fieldName: "end_date",
      fieldValue: "2026-01-01",
      daysUntil: 3,
      contractUrl: "https://app.test/c/1",
    });
    expect(out.error).toBeInstanceOf(Error);
    expect(out.error?.message).toMatch(/not configured/i);
    expect(safeFetchMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends via trusted Resend HTTP API without importing the SDK", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    safeFetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const { sendReminderEmail } = await import("@/lib/email");
    const out = await sendReminderEmail({
      to: "a@b.co",
      contractTitle: "C",
      fieldName: "end_date",
      fieldValue: "2026-01-01",
      daysUntil: 3,
      contractUrl: "https://app.test/c/1",
    });

    expect(out.error).toBeNull();
    expect(safeFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ href: "https://api.resend.com/emails" }),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
      })
    );
  });

  it("redacts sensitive reminder snippets before sending provider payloads", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    safeFetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const { sendReminderEmail } = await import("@/lib/email");
    const out = await sendReminderEmail({
      to: "a@b.co",
      contractTitle: "Contract",
      fieldName: "source",
      fieldValue: "Bearer field-secret-token",
      daysUntil: 3,
      contractUrl: "https://app.test/contracts/1?token=abc&signature=def",
      sourceSnippet: "Cookie: session=secret; Bearer snippet-secret-token",
    });

    expect(out.error).toBeNull();
    const [, init] = safeFetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String(init?.body ?? "{}")) as { html?: string; subject?: string };
    expect(payload.html).toContain("Bearer [redacted]");
    expect(payload.html).toContain("token=[redacted]");
    expect(payload.html).toContain("signature=[redacted]");
    expect(payload.html).not.toContain("field-secret-token");
    expect(payload.html).not.toContain("session=secret");
  });

  it("sanitizes review board HTML before sending provider payloads", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    safeFetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const { sendReviewBoardPacketEmail } = await import("@/lib/email");
    const out = await sendReviewBoardPacketEmail({
      to: "a@b.co",
      subject: "Packet",
      htmlBody:
        '<p onclick="steal()">ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a> Bearer html-secret-token',
    });

    expect(out.error).toBeNull();
    const [, init] = safeFetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String(init?.body ?? "{}")) as { html?: string };
    expect(payload.html?.toLowerCase()).not.toContain("<script");
    expect(payload.html?.toLowerCase()).not.toContain("onclick=");
    expect(payload.html?.toLowerCase()).not.toContain("javascript:");
    expect(payload.html).toContain("Bearer [redacted]");
    expect(payload.html).not.toContain("html-secret-token");
  });

  it("does not statically import the Resend SDK in production route bundles", () => {
    const source = readFileSync("src/lib/email.ts", "utf8");
    expect(source).not.toContain('from "resend"');
    expect(source).not.toContain("new Resend");
    expect(source).toContain('safeFetch(RESEND_EMAILS_URL');
    expect(source).not.toContain('fetch("https://api.resend.com/emails"');
  });
});
