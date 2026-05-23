import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extraction/run-pipeline", () => ({
  runExtractionPipeline: vi.fn(),
}));

const startExtractionJob = vi.fn();
const finishExtractionJob = vi.fn();
vi.mock("@/lib/extraction-job", () => ({
  startExtractionJob,
  finishExtractionJob,
}));

const requireApiWorkspaceEligibility = vi.fn();
vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

const rateLimitCheck = vi.fn();
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

const createClient = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

const SAMPLE_CONTRACT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("POST /api/extract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("wires workspace eligibility guard", async () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    expect(requireApiWorkspaceEligibility).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8", origin: "http://localhost:3000" },
        body: JSON.stringify({ contractId: SAMPLE_CONTRACT_ID }),
      })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Unauthorized");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 415 when Content-Type is set to a non-JSON value", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });
    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3000" },
        body: "a=b",
      })
    );
    expect(res.status).toBe(415);
  });

  it("returns 403 when authenticated browser-origin metadata is absent", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });
    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ contractId: SAMPLE_CONTRACT_ID }),
      })
    );
    await expect(res.json()).resolves.toMatchObject({
      code: "cross_site_request_rejected",
      diagnostic_id: "extract_cross_site_rejected",
    });
    expect(res.status).toBe(403);
    expect(createClient).toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });
    const { POST } = await import("@/app/api/extract/route");
    const req = new Request("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: "{",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_request",
      diagnostic_id: "route_invalid_request",
      details: { reason: "invalid_json" },
    });
  });

  it("returns 429 when rate limited (before auth)", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8", origin: "http://localhost:3000" },
        body: JSON.stringify({ contractId: SAMPLE_CONTRACT_ID }),
      })
    );
    expect(res.status).toBe(429);
  });

  it("returns 403 for viewer role before starting extraction work", async () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "contracts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: { organization_id: "org-1" } }),
                })),
              })),
            })),
          };
        }
        if (table === "organization_members") {
          return {
            select: vi.fn((selection: string) => {
              if (selection === "organization_id") {
                return {
                  eq: vi.fn().mockResolvedValue({ data: [{ organization_id: "org-1" }], error: null }),
                };
              }
              if (selection === "role") {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                          single: vi.fn().mockResolvedValue({ data: { role: "viewer" } }),
                        })),
                      })),
                    })),
                  })),
                };
              }
              throw new Error(`Unexpected organization_members selection ${selection}`);
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8", origin: "http://localhost:3000" },
        body: JSON.stringify({ contractId: SAMPLE_CONTRACT_ID }),
      })
    );

    expect(res.status).toBe(403);
    expect(requireApiWorkspaceEligibility).not.toHaveBeenCalled();
    expect(startExtractionJob).not.toHaveBeenCalled();
  });

  it("returns accepted without launching duplicate extraction work when a job is already in progress", async () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    startExtractionJob.mockResolvedValue({
      ok: false,
      status: 409,
      error: "Extraction already in progress",
    });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn((selection: string) => {
              if (selection === "organization_id") {
                return {
                  eq: vi.fn().mockResolvedValue({
                    data: [{ organization_id: "550e8400-e29b-41d4-a716-446655440001" }],
                    error: null,
                  }),
                };
              }
              if (selection === "role") {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                          single: vi.fn().mockResolvedValue({ data: { role: "editor" } }),
                        })),
                      })),
                    })),
                  })),
                };
              }
              throw new Error(`Unexpected organization_members selection ${selection}`);
            }),
          };
        }
        if (table === "contracts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { organization_id: "550e8400-e29b-41d4-a716-446655440001" },
                  }),
                })),
              })),
            })),
          };
        }
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { v6_org_settings_json: {} }, error: null }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8", origin: "http://localhost:3000" },
        body: JSON.stringify({ contractId: SAMPLE_CONTRACT_ID }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toMatchObject({
      accepted: true,
      async: true,
      message: "Extraction already in progress",
    });
    expect(startExtractionJob).toHaveBeenCalledTimes(1);
    expect(finishExtractionJob).not.toHaveBeenCalled();
  });

  it("authenticates and rate-limits before parsing the request body", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/extract/route.ts"), "utf8");
    const rateLimitIndex = source.indexOf("rateLimitCheck(");
    const bodyParseIndex = source.indexOf("readJsonBodyLimited(request,");
    const killSwitchIndex = source.indexOf("isKillExtraction()");
    const secFetchIndex = source.indexOf("secFetchSiteAllowsSensitiveMutation(request)");

    expect(source.indexOf("getUser()")).toBeGreaterThanOrEqual(0);
    expect(rateLimitIndex).toBeGreaterThanOrEqual(0);
    expect(bodyParseIndex).toBeGreaterThanOrEqual(0);
    expect(killSwitchIndex).toBeGreaterThanOrEqual(0);
    expect(secFetchIndex).toBeGreaterThanOrEqual(0);
    expect(source.indexOf("getUser()")).toBeLessThan(bodyParseIndex);
    expect(rateLimitIndex).toBeLessThan(bodyParseIndex);
    expect(source.indexOf("if (!user)")).toBeLessThan(killSwitchIndex);
    expect(secFetchIndex).toBeLessThan(killSwitchIndex);
  });
});
