import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import {
  API_PRIVATE_NO_STORE_HEADERS,
  requireBearerSecret,
  requireCronAuthorized,
  requireRoleAtLeast,
  requireSessionApiContext,
} from "@/lib/security/api-guards";

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext: vi.fn(),
}));

import { getApiAuthContext } from "@/lib/contract-operations/api-auth";

describe("api-guards", () => {
  beforeEach(() => {
    vi.mocked(getApiAuthContext).mockReset();
  });

  it("requireSessionApiContext returns 401 when unauthenticated", async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue(null);
    const res = await requireSessionApiContext();
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
    await expect((res as NextResponse).json()).resolves.toMatchObject({
      code: "unauthorized",
      diagnostic_id: "route_unauthorized",
    });
    expect((res as NextResponse).headers.get("Cache-Control")).toContain("no-store");
  });

  it("requireSessionApiContext returns ctx when authenticated", async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue({
      admin: {} as never,
      userId: "u1",
      orgId: "o1",
      role: "editor",
    });
    const res = await requireSessionApiContext();
    expect(res).toEqual(
      expect.objectContaining({ userId: "u1", orgId: "o1", role: "editor" })
    );
  });

  describe("requireCronAuthorized", () => {
    const prev = process.env.CRON_SECRET;

    afterEach(() => {
      process.env.CRON_SECRET = prev;
    });

    it("503 when CRON_SECRET unset (misconfiguration, not caller fault)", () => {
      delete process.env.CRON_SECRET;
      const req = new Request("https://x.test/cron", { headers: { authorization: "Bearer x" } });
      const res = requireCronAuthorized(req);
      expect(res?.status).toBe(503);
    });

    it("401 when secret wrong", () => {
      process.env.CRON_SECRET = "good";
      const req = new Request("https://x.test/cron", { headers: { authorization: "Bearer bad" } });
      const res = requireCronAuthorized(req);
      expect(res?.status).toBe(401);
    });

    it("null when Bearer matches", () => {
      process.env.CRON_SECRET = "good";
      const req = new Request("https://x.test/cron", { headers: { authorization: "Bearer good" } });
      expect(requireCronAuthorized(req)).toBeNull();
    });

    it("null when x-cron-secret matches", () => {
      process.env.CRON_SECRET = "good";
      const req = new Request("https://x.test/cron", { headers: { "x-cron-secret": "good" } });
      expect(requireCronAuthorized(req)).toBeNull();
    });
  });

  describe("requireBearerSecret", () => {
    const prev = process.env.EXTRACTION_WORKER_SECRET;

    afterEach(() => {
      process.env.EXTRACTION_WORKER_SECRET = prev;
    });

    it("401 when env unset", () => {
      delete process.env.EXTRACTION_WORKER_SECRET;
      const req = new Request("https://x.test/w", { headers: { authorization: "Bearer tok" } });
      const res = requireBearerSecret(req, "EXTRACTION_WORKER_SECRET");
      expect(res?.status).toBe(401);
      expect(res?.headers.get("Cache-Control")).toContain("no-store");
    });

    it("null when token matches", () => {
      process.env.EXTRACTION_WORKER_SECRET = "tok";
      const req = new Request("https://x.test/w", { headers: { authorization: "Bearer tok" } });
      expect(requireBearerSecret(req, "EXTRACTION_WORKER_SECRET")).toBeNull();
    });

    it("supports custom missing-secret responses", () => {
      delete process.env.EXTRACTION_WORKER_SECRET;
      const req = new Request("https://x.test/w", { headers: { authorization: "Bearer tok" } });
      const res = requireBearerSecret(req, "EXTRACTION_WORKER_SECRET", {
        missingSecretResponse: () => NextResponse.json({ error: "Worker not configured" }, { status: 503 }),
      });
      expect(res?.status).toBe(503);
    });

    it("supports custom unauthorized responses", () => {
      process.env.EXTRACTION_WORKER_SECRET = "tok";
      const req = new Request("https://x.test/w", { headers: { authorization: "Bearer nope" } });
      const res = requireBearerSecret(req, "EXTRACTION_WORKER_SECRET", {
        unauthorizedResponse: () => NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      });
      expect(res?.status).toBe(403);
    });
  });

  it("requireRoleAtLeast forbids viewer calling admin floor", () => {
    const ctx = { admin: {} as never, userId: "u", orgId: "o", role: "viewer" as const };
    const res = requireRoleAtLeast(ctx, "admin");
    expect(res?.status).toBe(403);
    expect(res?.headers.get("Cache-Control")).toContain("no-store");
  });

  it("requireRoleAtLeast allows admin for admin floor", () => {
    const ctx = { admin: {} as never, userId: "u", orgId: "o", role: "admin" as const };
    expect(requireRoleAtLeast(ctx, "admin")).toBeNull();
  });

  it("requireRoleAtLeast denies unsupported roles", () => {
    const ctx = { admin: {} as never, userId: "u", orgId: "o", role: "super_admin" as never };
    const res = requireRoleAtLeast(ctx, "viewer");
    expect(res?.status).toBe(403);
  });

  it("API_PRIVATE_NO_STORE_HEADERS includes Cache-Control", () => {
    expect(API_PRIVATE_NO_STORE_HEADERS["Cache-Control"]).toContain("no-store");
    expect(API_PRIVATE_NO_STORE_HEADERS.Vary).toContain("Cookie");
  });
});
