import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const rateLimitCheck = vi.fn();
const buildOrganizationCalendarIcs = vi.fn();
const emitProductTelemetryEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/integrations/calendar", () => ({
  buildOrganizationCalendarIcs,
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent,
}));

describe("GET /api/export/calendar", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true, retryAfterMs: 0 });
    getDeterministicMembership.mockResolvedValue({
      organization_id: "550e8400-e29b-41d4-a716-446655440001",
      role: "editor",
    });
    buildOrganizationCalendarIcs.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
    emitProductTelemetryEvent.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { GET } = await import("@/app/api/export/calendar/route");
    const req = new Request("http://localhost:3000/api/export/calendar");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("records export lifecycle telemetry for calendar exports", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({});

    const { GET } = await import("@/app/api/export/calendar/route");
    const req = new Request("http://localhost:3000/api/export/calendar?role=finance");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(buildOrganizationCalendarIcs).toHaveBeenCalled();
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_started",
        details: expect.objectContaining({ export_type: "calendar_ics", role: "finance" }),
      })
    );
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_completed",
        details: expect.objectContaining({ export_type: "calendar_ics" }),
      })
    );
  });

  it("maps calendar build failures to export_failed telemetry", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({});
    buildOrganizationCalendarIcs.mockRejectedValue(new Error("calendar exploded"));

    const { GET } = await import("@/app/api/export/calendar/route");
    const req = new Request("http://localhost:3000/api/export/calendar");
    const res = await GET(req);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Could not build calendar export." });
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_failed",
        details: expect.objectContaining({ export_type: "calendar_ics", reason: "calendar_build_failed" }),
      })
    );
  });
});

