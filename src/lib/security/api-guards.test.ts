import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import {
  API_PRIVATE_NO_STORE_HEADERS,
  requireBearerSecret,
  requireCronAuthorized,
  requireRoleAtLeast,
  requireSessionApiContext,
} from "@/lib/security/api-guards";

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext: vi.fn(),
}));

import { getApiAuthContext } from "@/lib/v4/api-auth";

describe("api-guards", () => {
  beforeEach(() => {
    vi.mocked(getApiAuthContext).mockReset();
  });

  it("requireSessionApiContext returns 401 when unauthenticated", async () => {
    vi.mocked(getApiAuthContext).mockResolvedValue(null);
    const res = await requireSessionApiContext();
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
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

    it("401 when CRON_SECRET unset", () => {
      delete process.env.CRON_SECRET;
      const req = new Request("https://x.test/cron", { headers: { authorization: "Bearer x" } });
      const res = requireCronAuthorized(req);
      expect(res?.status).toBe(401);
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
      expect(requireBearerSecret(req, "EXTRACTION_WORKER_SECRET")?.status).toBe(401);
    });

    it("null when token matches", () => {
      process.env.EXTRACTION_WORKER_SECRET = "tok";
      const req = new Request("https://x.test/w", { headers: { authorization: "Bearer tok" } });
      expect(requireBearerSecret(req, "EXTRACTION_WORKER_SECRET")).toBeNull();
    });
  });

  it("requireRoleAtLeast forbids viewer calling admin floor", () => {
    const ctx = { admin: {} as never, userId: "u", orgId: "o", role: "viewer" as const };
    const res = requireRoleAtLeast(ctx, "admin");
    expect(res?.status).toBe(403);
  });

  it("requireRoleAtLeast allows admin for admin floor", () => {
    const ctx = { admin: {} as never, userId: "u", orgId: "o", role: "admin" as const };
    expect(requireRoleAtLeast(ctx, "admin")).toBeNull();
  });

  it("API_PRIVATE_NO_STORE_HEADERS includes Cache-Control", () => {
    expect(API_PRIVATE_NO_STORE_HEADERS["Cache-Control"]).toContain("no-store");
  });
});
