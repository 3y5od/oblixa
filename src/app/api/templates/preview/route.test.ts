import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/permissions", () => ({
  getOrgMemberRole: vi.fn(async () => "admin" as const),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

describe("GET /api/templates/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns 400 for invalid contractId", async () => {
    const { GET } = await import("@/app/api/templates/preview/route");
    const req = new Request("http://localhost:3000/api/templates/preview?contractId=bad-id");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid contractId" });
  });

  it("queries contracts scoped to user organization memberships", async () => {
    const contractId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const orgId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const inSpy = vi.fn().mockReturnValue({
      maybeSingle: vi.fn(async () => ({
        data: { id: contractId, organization_id: orgId, contract_type: "msa" },
        error: null,
      })),
    });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    });
    const templateBranch = {
      select: () => ({
        eq: () => ({
          eq: () => ({
            or: vi.fn(async () => ({ data: [], error: null })),
          }),
        }),
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: () => ({
              eq: vi.fn(async () => ({ data: [{ organization_id: orgId }], error: null })),
            }),
          };
        }
        if (table === "contracts") {
          return {
            select: () => ({
              eq: () => ({ in: inSpy }),
            }),
          };
        }
        if (table === "field_templates" || table === "reminder_templates" || table === "task_templates") {
          return templateBranch;
        }
        if (table === "extracted_fields" || table === "reminders") {
          return {
            select: () => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            }),
          };
        }
        if (table === "contract_tasks") {
          return {
            select: () => ({
              eq: () => ({
                in: vi.fn(async () => ({ data: [], error: null })),
              }),
            }),
          };
        }
        return templateBranch;
      }),
    });

    const { GET } = await import("@/app/api/templates/preview/route");
    const req = new Request(
      `http://localhost:3000/api/templates/preview?contractId=${contractId}`
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(inSpy).toHaveBeenCalledWith("organization_id", [orgId]);
  });

  it("returns 429 before admin queries when rate limited", async () => {
    const contractId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    });
    rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 5_000 });

    const { GET } = await import("@/app/api/templates/preview/route");
    const req = new Request(
      `http://localhost:3000/api/templates/preview?contractId=${contractId}`
    );
    const res = await GET(req);

    expect(res.status).toBe(429);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ error: "Too many requests" });
  });
});

