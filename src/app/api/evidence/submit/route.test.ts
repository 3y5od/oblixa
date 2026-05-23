import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

describe("POST /api/evidence/submit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/evidence/submit/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 403 when user lacks capability", async () => {
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({ admin, orgId: "org-1", userId: "user-1" });
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/evidence/submit/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toMatchObject({
      outcome: "forbidden",
      diagnostic_id: "v10_evidence_submit_forbidden",
    });
    expect(requireApiWorkspaceEligibility).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("returns 404 when requirement does not belong to org", async () => {
    const requirementQuery = {
      select: vi.fn(() => requirementQuery),
      eq: vi.fn(() => requirementQuery),
      maybeSingle: vi.fn(async () => ({ data: null })),
    };
    const admin = {
      from: vi.fn(() => requirementQuery),
    };
    getApiAuthContext.mockResolvedValueOnce({ admin, orgId: "org-1", userId: "user-1" });
    canManageCapability.mockResolvedValueOnce(true);

    const { POST } = await import("@/app/api/evidence/submit/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirementId: "missing" }),
      })
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toMatchObject({
      outcome: "not_found",
      diagnostic_id: "v10_evidence_submit_requirement_not_found",
    });
  });

  it("allows unauthenticated external token submissions to fail closed on expired scoped links", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const token = "external-token-123";
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const requirementQuery = {
      select: vi.fn(() => requirementQuery),
      eq: vi.fn(() => requirementQuery),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "req-1",
          organization_id: "org-1",
          contract_id: "contract-1",
          reviewer_id: "00000000-0000-0000-0000-000000000001",
          config_json: {
            external_token_hash: tokenHash,
            external_token_expires_at: "2026-01-01T00:00:00.000Z",
          },
        },
      })),
    };
    const admin = {
      from: vi.fn(() => requirementQuery),
    };
    createAdminClient.mockResolvedValueOnce(admin);

    const { POST } = await import("@/app/api/evidence/submit/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/submit", {
        method: "POST",
        headers: { "content-type": "application/json", "x-v10-external-evidence-token": token },
        body: JSON.stringify({ requirementId: "req-1", payload: { note: "SOC report attached" } }),
      })
    );

    expect(res.status).toBe(410);
    expect(createAdminClient).toHaveBeenCalled();
    expect(await res.json()).toMatchObject({
      outcome: "external_link_expired",
      diagnostic_id: "v10_external_evidence_submit_expired",
    });
  });

  it("checks auth before parsing the request body", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/evidence/submit/route.ts"), "utf8");
    const postStart = source.indexOf("export async function POST");
    const authIndex = source.indexOf("getApiAuthContext()", postStart);
    const bodyParseIndex = source.indexOf("readJsonBodyLimited(request)", postStart);

    expect(postStart).toBeGreaterThanOrEqual(0);
    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(bodyParseIndex).toBeGreaterThanOrEqual(0);
    expect(authIndex).toBeLessThan(bodyParseIndex);
  });

  it("threads V10 idempotency keys into replayable evidence mutations", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/evidence/submit/route.ts"), "utf8");
    const authenticatedMutation = source.indexOf('mutationName: "evidence.submit"');
    const idempotencyKey = source.indexOf("idempotencyKey: getV10IdempotencyKeyFromRequest(request)", authenticatedMutation);
    const callback = source.indexOf("async () =>", authenticatedMutation);

    expect(authenticatedMutation).toBeGreaterThanOrEqual(0);
    expect(idempotencyKey).toBeGreaterThan(authenticatedMutation);
    expect(callback).toBeGreaterThan(idempotencyKey);
  });
});
