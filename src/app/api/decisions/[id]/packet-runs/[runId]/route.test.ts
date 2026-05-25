import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderDecisionPacketPdfBuffer } from "@/lib/decision-intelligence/decision-packet-pdf";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const recordV10AuditEvent = vi.fn(async (...args: unknown[]) => {
  void args;
  return "audit-1";
});

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/decision-intelligence/decision-packet-pdf", () => ({
  renderDecisionPacketPdfBuffer: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

vi.mock("@/lib/server-contracts", () => ({
  recordV10AuditEvent: (...args: unknown[]) => recordV10AuditEvent(...args),
}));

describe("GET /api/decisions/[id]/packet-runs/[runId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireV5ApiFeature).mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
  });

  it("returns attachment JSON when run belongs to decision", async () => {
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "run-1",
                    packet_type: "renewal_packet",
                    payload_json: { hello: true },
                    exported_at: "2026-01-01T00:00:00Z",
                    created_at: "2026-01-01T00:00:00Z",
                    decision_workspace_id: "dec-1",
                    artifact_storage_path: null,
                    artifact_pdf_storage_path: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
    } as never);

    const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
    const res = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ hello: true });
  });

  it("returns HTML when format=html", async () => {
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "run-1",
                    packet_type: "renewal_packet",
                    payload_json: { decision: { title: "T1" } },
                    exported_at: "2026-01-01T00:00:00Z",
                    created_at: "2026-01-01T00:00:00Z",
                    decision_workspace_id: "dec-1",
                    artifact_storage_path: null,
                    artifact_pdf_storage_path: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
    } as never);

    const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
    const res = await GET(new Request("http://localhost/api?format=html"), {
      params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("T1");
    expect(text).toContain("<!DOCTYPE html>");
  });

  it("returns application/pdf when format=pdf", async () => {
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "run-1",
                    packet_type: "renewal_packet",
                    payload_json: { decision: { title: "T2" } },
                    exported_at: null,
                    created_at: "2026-01-01T00:00:00Z",
                    decision_workspace_id: "dec-1",
                    artifact_storage_path: null,
                    artifact_pdf_storage_path: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
    } as never);

    const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
    const res = await GET(new Request("http://localhost/api?format=pdf"), {
      params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(vi.mocked(renderDecisionPacketPdfBuffer)).toHaveBeenCalled();
  });

  it("returns HTML when format=html", async () => {
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "run-1",
                    packet_type: "renewal_packet",
                    payload_json: {},
                    exported_at: null,
                    created_at: "2026-01-01T00:00:00Z",
                    decision_workspace_id: "dec-1",
                    artifact_storage_path: null,
                    artifact_pdf_storage_path: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
    } as never);

    const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
    const res = await GET(new Request("http://localhost/api?format=html"), {
      params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("returns 400 for unknown format", async () => {
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "run-1",
                    packet_type: "renewal_packet",
                    payload_json: {},
                    exported_at: null,
                    created_at: "2026-01-01T00:00:00Z",
                    decision_workspace_id: "dec-1",
                    artifact_storage_path: null,
                    artifact_pdf_storage_path: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
    } as never);

    const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
    const res = await GET(new Request("http://localhost/api?format=xml"), {
      params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when decision id mismatches run", async () => {
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "run-1",
                    packet_type: "renewal_packet",
                    payload_json: {},
                    exported_at: null,
                    created_at: "2026-01-01T00:00:00Z",
                    decision_workspace_id: "other-dec",
                    artifact_storage_path: null,
                    artifact_pdf_storage_path: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
    } as never);

    const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
    const res = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns signed URL JSON when signed=1 and artifact path exists", async () => {
    const prev = process.env.V5_DECISION_PACKET_BUCKET;
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    try {
      const createSignedUrl = vi.fn(async () => ({
        data: { signedUrl: "https://example.com/signed" },
        error: null,
      }));
      getApiAuthContext.mockResolvedValue({
        userId: "u1",
        orgId: "o1",
        admin: {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "run-1",
                      packet_type: "renewal_packet",
                      payload_json: {},
                      exported_at: null,
                      created_at: "2026-01-01T00:00:00Z",
                      decision_workspace_id: "dec-1",
                      artifact_storage_path: "o1/run-1/packet.json",
                      artifact_pdf_storage_path: "o1/run-1/packet.pdf",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
          storage: {
            from: vi.fn(() => ({ createSignedUrl })),
          },
        },
      } as never);

      const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
      const res = await GET(new Request("http://localhost/api?signed=1"), {
        params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.signedUrl).toBe("https://example.com/signed");
      expect(body.expiresIn).toBe(300);
      expect(typeof body.expiresAt).toBe("string");
      expect(body.artifact).toBe("json");
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(createSignedUrl).toHaveBeenCalledWith("o1/run-1/packet.json", 300);
      expect(recordV10AuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "decision_packet_artifact.download_url_created",
          targetId: "run-1",
          safeMetadata: expect.objectContaining({ artifact: "json", expires_in_seconds: 300 }),
        })
      );
    } finally {
      process.env.V5_DECISION_PACKET_BUCKET = prev;
    }
  });

  it("returns signed URL for PDF artifact when signed=1&artifact=pdf", async () => {
    const prev = process.env.V5_DECISION_PACKET_BUCKET;
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    try {
      const createSignedUrl = vi.fn(async () => ({
        data: { signedUrl: "https://example.com/signed-pdf" },
        error: null,
      }));
      getApiAuthContext.mockResolvedValue({
        userId: "u1",
        orgId: "o1",
        admin: {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "run-1",
                      packet_type: "renewal_packet",
                      payload_json: {},
                      exported_at: null,
                      created_at: "2026-01-01T00:00:00Z",
                      decision_workspace_id: "dec-1",
                      artifact_storage_path: "o1/run-1/packet.json",
                      artifact_pdf_storage_path: "o1/run-1/packet.pdf",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
          storage: {
            from: vi.fn(() => ({ createSignedUrl })),
          },
        },
      } as never);

      const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
      const res = await GET(new Request("http://localhost/api?signed=1&artifact=pdf"), {
        params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.signedUrl).toBe("https://example.com/signed-pdf");
      expect(body.artifact).toBe("pdf");
      expect(body.expiresIn).toBe(300);
    } finally {
      process.env.V5_DECISION_PACKET_BUCKET = prev;
    }
  });

  it("rejects cross-org artifact storage paths before signing", async () => {
    const prev = process.env.V5_DECISION_PACKET_BUCKET;
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    try {
      const createSignedUrl = vi.fn(async () => ({
        data: { signedUrl: "https://example.com/signed" },
        error: null,
      }));
      getApiAuthContext.mockResolvedValue({
        userId: "u1",
        orgId: "o1",
        admin: {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "run-1",
                      packet_type: "renewal_packet",
                      payload_json: {},
                      exported_at: null,
                      created_at: "2026-01-01T00:00:00Z",
                      decision_workspace_id: "dec-1",
                      artifact_storage_path: "other-org/run-1/packet.json",
                      artifact_pdf_storage_path: "o1/run-1/packet.pdf",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
          storage: {
            from: vi.fn(() => ({ createSignedUrl })),
          },
        },
      } as never);

      const { GET } = await import("@/app/api/decisions/[id]/packet-runs/[runId]/route");
      const res = await GET(new Request("http://localhost/api?signed=1"), {
        params: Promise.resolve({ id: "dec-1", runId: "run-1" }),
      });
      expect(res.status).toBe(404);
      expect(createSignedUrl).not.toHaveBeenCalled();
    } finally {
      process.env.V5_DECISION_PACKET_BUCKET = prev;
    }
  });
});
