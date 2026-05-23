import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInternalRequest } from "@/lib/security/internal-hmac";

const runExtractionPipeline = vi.fn();
const rateLimitCheck = vi.fn();
const enforceIdempotency = vi.fn();
const createAdminClient = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

let orgSettings: Record<string, unknown>;
let adminClient: { from: ReturnType<typeof vi.fn> };

vi.mock("@/lib/extraction/run-pipeline", () => ({
  runExtractionPipeline,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { extractWorker: { max: 120, windowMs: 60_000 } },
  getClientIpFromRequest: () => "127.0.0.1",
  rateLimitCheck,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

describe("POST /api/extract/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    orgSettings = {};
    adminClient = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { v6_org_settings_json: orgSettings },
                  error: null,
                })),
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    process.env.EXTRACTION_WORKER_SECRET = "topsecret";
    delete process.env.OBLIXA_INTERNAL_HMAC_SECRET;
    delete process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET;
    delete process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT;
    createAdminClient.mockResolvedValue(adminClient);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
    rateLimitCheck.mockResolvedValue({ ok: true });
    enforceIdempotency.mockResolvedValue(null);
  });

  it("returns 401 when bearer token is missing", async () => {
    const { POST } = await import("@/app/api/extract/run/route");
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
  });

  it("returns 400 for invalid ids", async () => {
    const { POST } = await import("@/app/api/extract/run/route");
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer topsecret",
      },
      body: JSON.stringify({
        contractId: "abc",
        userId: "def",
        organizationId: "ghi",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "Invalid ids",
      code: "invalid_ids",
      diagnostic_id: "extract_worker_invalid_ids",
    });
    expect(runExtractionPipeline).not.toHaveBeenCalled();
  });

  it("runs pipeline and returns ok for valid request", async () => {
    runExtractionPipeline.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer topsecret",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(recordApiMutationAuditEvent).toHaveBeenCalledWith(
      adminClient,
      expect.objectContaining({
        organizationId: payload.organizationId,
        actorUserId: payload.userId,
        actorType: "system",
        route: "/api/extract/run",
        method: "POST",
      })
    );
    expect(runExtractionPipeline).toHaveBeenCalledWith({
      ...payload,
      admin: adminClient,
    });
  });

  it("accepts timestamped HMAC signed worker requests when configured", async () => {
    process.env.OBLIXA_INTERNAL_HMAC_SECRET = "current-internal-hmac-secret-32-bytes";
    delete process.env.EXTRACTION_WORKER_SECRET;
    runExtractionPipeline.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const body = JSON.stringify(payload);
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...signInternalRequest({
          secret: process.env.OBLIXA_INTERNAL_HMAC_SECRET,
          method: "POST",
          path: "/api/extract/run",
          body,
        }),
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(runExtractionPipeline).toHaveBeenCalledWith({
      ...payload,
      admin: adminClient,
    });
  });

  it("accepts previous HMAC secret only with future expiry metadata", async () => {
    process.env.OBLIXA_INTERNAL_HMAC_SECRET = "current-internal-hmac-secret-32-bytes";
    process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET = "previous-internal-hmac-secret-32-bytes";
    process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT = "2099-01-01T00:00:00.000Z";
    delete process.env.EXTRACTION_WORKER_SECRET;
    runExtractionPipeline.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const body = JSON.stringify(payload);
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...signInternalRequest({
          secret: process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET,
          method: "POST",
          path: "/api/extract/run",
          body,
          keyId: "previous",
        }),
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("rejects previous HMAC secret with expired metadata", async () => {
    process.env.OBLIXA_INTERNAL_HMAC_SECRET = "current-internal-hmac-secret-32-bytes";
    process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET = "previous-internal-hmac-secret-32-bytes";
    process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT = "2000-01-01T00:00:00.000Z";
    delete process.env.EXTRACTION_WORKER_SECRET;
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const body = JSON.stringify(payload);
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...signInternalRequest({
          secret: process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET,
          method: "POST",
          path: "/api/extract/run",
          body,
          keyId: "previous",
        }),
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: "previous_secret_expired" });
  });

  it("rejects stale or missing worker HMAC signatures without falling back to bearer", async () => {
    process.env.OBLIXA_INTERNAL_HMAC_SECRET = "current-internal-hmac-secret-32-bytes";
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const body = JSON.stringify(payload);
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer topsecret",
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      code: "internal_signature_invalid",
      diagnostic_id: "extract_worker_internal_signature_invalid",
    });
    expect(runExtractionPipeline).not.toHaveBeenCalled();
  });

  it("rejects production extraction when tenant AI processing is not enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.OBLIXA_INTERNAL_HMAC_SECRET = "current-internal-hmac-secret-32-bytes";
    orgSettings = { ai_processing_enabled: false };
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...signInternalRequest({
          secret: process.env.OBLIXA_INTERNAL_HMAC_SECRET,
          method: "POST",
          path: "/api/extract/run",
          body: JSON.stringify(payload),
          keyId: "current",
        }),
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      code: "tenant_ai_processing_disabled",
      diagnostic_id: "extract_worker_tenant_ai_disabled",
    });
    expect(runExtractionPipeline).not.toHaveBeenCalled();
  });

  it("returns duplicate response when idempotency blocks a replay", async () => {
    const duplicate = new Response(JSON.stringify({ error: "Duplicate request blocked by idempotency key" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
    enforceIdempotency.mockResolvedValue(duplicate);
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer topsecret",
        "x-idempotency-key": "extract-worker-duplicate-key",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(runExtractionPipeline).not.toHaveBeenCalled();
  });
});
