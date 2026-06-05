import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.fn();
const getTrustedClientIpFromRequest = vi.fn();
const safeFetch = vi.fn();
const accessRequestMaybeSingle = vi.fn();
const accessRequestEq = vi.fn(() => ({ maybeSingle: accessRequestMaybeSingle }));
const accessRequestLookupSelect = vi.fn(() => ({ eq: accessRequestEq }));
const accessRequestSingle = vi.fn();
const accessRequestSelect = vi.fn(() => ({ single: accessRequestSingle }));
const accessRequestInsert = vi.fn(() => ({ select: accessRequestSelect }));
const accessRequestUpdateEq = vi.fn(async () => ({ error: null }));
const accessRequestUpdate = vi.fn(() => ({ eq: accessRequestUpdateEq }));
const accessRequestEventInsert = vi.fn(async () => ({ error: null }));
const createAdminClient = vi.fn(async () => ({
  from: vi.fn((table: string) => {
    if (table === "workspace_access_requests") {
      return { select: accessRequestLookupSelect, insert: accessRequestInsert, update: accessRequestUpdate };
    }
    if (table === "workspace_access_request_events") {
      return { insert: accessRequestEventInsert };
    }
    throw new Error(`Unexpected table ${table}`);
  }),
}));

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

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
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
    interested: "request_access",
    trackingMethod: "spreadsheet",
    hasTracker: "yes",
    redactedSample: "unsure",
    preference: "async",
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
    accessRequestMaybeSingle.mockResolvedValue({ data: null, error: null });
    accessRequestSingle.mockResolvedValue({ data: { id: "00000000-0000-0000-0000-000000000001" }, error: null });
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
    expect(accessRequestInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        normalized_email: "valid-1@example.com",
        status: "pending",
        source: "request_access",
      })
    );
    expect(accessRequestEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "00000000-0000-0000-0000-000000000001",
        action: "access_request.received",
      })
    );
  });

  it("accepts blank optional tracker/sample fields and records them as unsure", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest(
        JSON.stringify(
          validPayload({
            email: "optional-fields@example.com",
            hasTracker: "",
            redactedSample: "",
          })
        )
      )
    );

    expect(res.status).toBe(204);
    expect(accessRequestInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        normalized_email: "optional-fields@example.com",
        has_tracker: "unsure",
        redacted_sample_available: "unsure",
      })
    );
  });

  it("updates an existing access request instead of creating a duplicate row", async () => {
    accessRequestMaybeSingle.mockResolvedValueOnce({
      data: { id: "00000000-0000-0000-0000-0000000000aa", duplicate_count: 2 },
      error: null,
    });
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(contactRequest(JSON.stringify(validPayload({ email: "valid-duplicate@example.com" }))));

    expect(res.status).toBe(204);
    expect(accessRequestInsert).not.toHaveBeenCalled();
    expect(accessRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicate_count: 3,
        source: "request_access",
      })
    );
    expect(accessRequestEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "00000000-0000-0000-0000-0000000000aa",
        action: "access_request.duplicate_received",
      })
    );
  });

  it("rejects legacy public interest values", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest(
        JSON.stringify(
          validPayload({
            email: "invalid-interest@example.com",
            interested: "assurance_workflows",
          })
        )
      )
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.details?.reason).toBe("invalid_interested");
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

  it("logs non-OK email provider responses without rejecting accepted submissions", async () => {
    process.env.RESEND_API_KEY = "re_private_contact_key";
    process.env.EMAIL_FROM = "hello@oblixa.test";
    process.env.CONTACT_NOTIFY_EMAIL = "sales@oblixa.test";
    safeFetch.mockResolvedValueOnce(new Response("provider unavailable", { status: 503 }));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      contactRequest(
        JSON.stringify(
          validPayload({
            email: "provider-non-ok@example.com",
            interested: "general",
            message: "Sensitive free-text launch inquiry.",
          })
        )
      )
    );

    expect(res.status).toBe(204);
    expect(safeFetch).toHaveBeenCalledOnce();
    const logText = JSON.stringify(error.mock.calls);
    expect(logText).toContain("[contact] notification email failed");
    expect(logText).not.toContain("provider-non-ok@example.com");
    expect(logText).not.toContain("Sensitive free-text launch inquiry.");
    error.mockRestore();
  });
});
