import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled } from "@/lib/feature-flags";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

const rateLimitCheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

const mockedFlag = vi.mocked(isFeatureEnabled);

describe("GET /api/external-actions/[token]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFlag.mockReturnValue(true);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 429 when rate limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 4000 });
    const { GET } = await import("@/app/api/external-actions/[token]/status/route");
    const res = await GET(new Request("http://localhost/status"), {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("4");
    const { createAdminClient } = await import("@/lib/supabase/server");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 403 when external collaboration flag is off", async () => {
    mockedFlag.mockReturnValueOnce(false);
    const { GET } = await import("@/app/api/external-actions/[token]/status/route");
    const res = await GET(new Request("http://localhost/status"), {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("includes submitTicket when requires_reauth and link is open", async () => {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const future = new Date(Date.now() + 86400000).toISOString();
    vi.mocked(createAdminClient).mockResolvedValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "lid-1",
                action_type: "submit_evidence",
                status: "open",
                expires_at: future,
                requires_reauth: true,
                submitted_at: null,
              },
              error: null,
            })),
          })),
        })),
      })),
    } as never);

    const { GET } = await import("@/app/api/external-actions/[token]/status/route");
    const res = await GET(new Request("http://localhost/status"), {
      params: Promise.resolve({ token: "url-token-xyz" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { externalAction?: { submitTicket?: string } };
    expect(body.externalAction?.submitTicket).toMatch(/^[A-Za-z0-9_-]+/);
  });
});
