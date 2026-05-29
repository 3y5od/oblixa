import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.fn();
const getTrustedClientIpFromRequest = vi.fn();
const safeFetch = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { marketingContact: { max: 5, windowMs: 60 * 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/security/trusted-forwarded", () => ({
  getTrustedClientIpFromRequest,
}));

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch,
}));

function contactRequest(body: string, headers: HeadersInit = { "Content-Type": "application/json" }) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers,
    body,
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Contact Tester",
    email: "contact-tester@example.com",
    company: "Acme Co",
    role: "Operations lead",
    contracts: "50-200",
    interested: "core",
    pain: "Renewal dates are easy to miss.",
    message: "Please send details.",
    ...overrides,
  };
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.CONTACT_NOTIFY_EMAIL;
    getTrustedClientIpFromRequest.mockReturnValue("203.0.113.10");
    rateLimitCheck.mockResolvedValue({ ok: true });
    safeFetch.mockResolvedValue(new Response(null, { status: 202 }));
  });

  it("accepts a valid public submission without requiring email provider config", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(contactRequest(JSON.stringify(validPayload({ email: "valid-1@example.com" }))));

    expect(res.status).toBe(204);
    expect(rateLimitCheck).toHaveBeenCalledWith(
      "/api/contact:203.0.113.10",
      expect.objectContaining({ max: 5 })
    );
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("accepts the release-state assurance workflows interest value", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest(
        JSON.stringify(
          validPayload({
            email: "valid-assurance@example.com",
            interested: "assurance_workflows",
          })
        )
      )
    );

    expect(res.status).toBe(204);
  });

  it("rejects malformed JSON", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(contactRequest("{not-json"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.details?.reason).toBe("invalid_json");
  });

  it("rejects non-JSON content types", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(contactRequest("name=Contact", { "Content-Type": "text/plain" }));

    expect(res.status).toBe(415);
  });

  it("rejects oversized declared bodies before parsing", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest("{}", {
        "Content-Type": "application/json",
        "Content-Length": String(32 * 1024 + 1),
      })
    );

    expect(res.status).toBe(413);
  });

  it("rejects unsafe JSON keys", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(contactRequest('{"__proto__":{"polluted":true}}'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.details?.reason).toBe("unsafe_json_key");
  });

  it("silently accepts honeypot submissions without side effects", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest(
        JSON.stringify(validPayload({ email: "honeypot@example.com", website: "https://spam.example" }))
      )
    );

    expect(res.status).toBe(204);
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 429 when the public contact rate limit is exceeded", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 30_000 });
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(contactRequest(JSON.stringify(validPayload({ email: "limited@example.com" }))));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("does not log submitted email or message content when email provider config is missing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest(
        JSON.stringify(
          validPayload({
            email: "private-contact@example.com",
            message: "This free text should never appear in fallback logs.",
          })
        )
      )
    );

    expect(res.status).toBe(204);
    const logText = JSON.stringify(info.mock.calls);
    expect(logText).not.toContain("private-contact@example.com");
    expect(logText).not.toContain("This free text should never appear");
    info.mockRestore();
  });

  it("does not log submitted email, message content, or provider secrets when notification delivery fails", async () => {
    process.env.RESEND_API_KEY = "re_private_contact_key";
    process.env.EMAIL_FROM = "hello@oblixa.test";
    process.env.CONTACT_NOTIFY_EMAIL = "sales@oblixa.test";
    safeFetch.mockRejectedValueOnce(
      new Error("delivery failed for provider-failure@example.com with re_private_contact_key")
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest(
        JSON.stringify(
          validPayload({
            email: "provider-failure@example.com",
            message: "Sensitive free-text launch inquiry.",
          })
        )
      )
    );

    expect(res.status).toBe(204);
    expect(safeFetch).toHaveBeenCalledOnce();
    const logText = JSON.stringify(error.mock.calls);
    expect(logText).toContain("[contact] notification email failed");
    expect(logText).not.toContain("provider-failure@example.com");
    expect(logText).not.toContain("Sensitive free-text launch inquiry.");
    expect(logText).not.toContain("re_private_contact_key");
    error.mockRestore();
  });
});
