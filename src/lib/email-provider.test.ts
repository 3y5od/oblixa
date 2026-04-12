import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("sendReminderEmail without provider", () => {
  const prevKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = prevKey;
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
  });
});
