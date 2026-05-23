import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DECISION_PACKET_SIGNED_URL_TTL_SECONDS,
  createDecisionPacketArtifactSignedUrl,
  decisionPacketPdfStoragePath,
  decisionPacketStoragePath,
  isDecisionPacketArtifactStoragePathScoped,
  normalizeDecisionPacketSignedUrlTtl,
  uploadDecisionPacketPdfArtifact,
  uploadDecisionPacketJsonArtifact,
} from "@/lib/v5/decision-packet-storage";

describe("decision-packet-storage", () => {
  afterEach(() => {
    delete process.env.V5_DECISION_PACKET_BUCKET;
  });

  it("decisionPacketStoragePath is org-scoped", () => {
    expect(decisionPacketStoragePath("org-a", "run-1")).toBe("org-a/run-1/packet.json");
  });

  it("decisionPacketPdfStoragePath is org-scoped", () => {
    expect(decisionPacketPdfStoragePath("org-a", "run-1")).toBe("org-a/run-1/packet.pdf");
  });

  it("validates decision packet artifact paths against org, run, and artifact kind", () => {
    expect(
      isDecisionPacketArtifactStoragePathScoped("org-a/run-1/packet.json", {
        orgId: "org-a",
        runId: "run-1",
        artifact: "json",
      })
    ).toBe(true);
    expect(
      isDecisionPacketArtifactStoragePathScoped("org-b/run-1/packet.json", {
        orgId: "org-a",
        runId: "run-1",
        artifact: "json",
      })
    ).toBe(false);
    expect(
      isDecisionPacketArtifactStoragePathScoped("org-a/run-1/expired/packet.json", {
        orgId: "org-a",
        runId: "run-1",
        artifact: "json",
      })
    ).toBe(false);
    expect(
      isDecisionPacketArtifactStoragePathScoped("org-a/run-1/packet.json", {
        orgId: "org-a",
        runId: "run-1",
        artifact: "pdf",
      })
    ).toBe(false);
  });

  it("caps signed URL TTLs to the short-lived packet maximum", () => {
    expect(normalizeDecisionPacketSignedUrlTtl(120)).toBe(120);
    expect(normalizeDecisionPacketSignedUrlTtl(3600)).toBe(DECISION_PACKET_SIGNED_URL_TTL_SECONDS);
    expect(normalizeDecisionPacketSignedUrlTtl(Number.NaN)).toBe(DECISION_PACKET_SIGNED_URL_TTL_SECONDS);
  });

  it("uploadDecisionPacketJsonArtifact returns null when bucket unset", async () => {
    const admin = { storage: { from: vi.fn() } } as never;
    const r = await uploadDecisionPacketJsonArtifact(admin, {
      orgId: "o1",
      runId: "r1",
      payload: { a: 1 },
    });
    expect(r).toBeNull();
  });

  it("uploadDecisionPacketJsonArtifact returns null when storage API missing", async () => {
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    const admin = { storage: undefined } as never;
    const r = await uploadDecisionPacketJsonArtifact(admin, {
      orgId: "o1",
      runId: "r1",
      payload: {},
    });
    expect(r).toBeNull();
  });

  it("uploadDecisionPacketJsonArtifact uploads when bucket set", async () => {
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    const upload = vi.fn(async () => ({ error: null }));
    const admin = {
      storage: {
        from: vi.fn(() => ({ upload })),
      },
    } as never;

    const r = await uploadDecisionPacketJsonArtifact(admin, {
      orgId: "o1",
      runId: "r1",
      payload: { x: true },
    });

    if (r && 'error' in r) throw new Error(r.error);
    expect(r?.storagePath).toBe("o1/r1/packet.json");
    expect(upload).toHaveBeenCalledWith(
      "o1/r1/packet.json",
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/json; charset=utf-8", upsert: true })
    );
  });

  it("createDecisionPacketArtifactSignedUrl returns URL when bucket set", async () => {
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://example.com/signed" },
      error: null,
    }));
    const admin = {
      storage: {
        from: vi.fn(() => ({ createSignedUrl })),
      },
    } as never;

    const r = await createDecisionPacketArtifactSignedUrl(admin, "o1/r1/packet.json", 120);
    expect(r?.signedUrl).toBe("https://example.com/signed");
    expect(r?.expiresIn).toBe(120);
    expect(createSignedUrl).toHaveBeenCalledWith("o1/r1/packet.json", 120);
  });

  it("caps overlong signed URL TTLs before storage signing", async () => {
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://example.com/signed" },
      error: null,
    }));
    const admin = {
      storage: {
        from: vi.fn(() => ({ createSignedUrl })),
      },
    } as never;

    const r = await createDecisionPacketArtifactSignedUrl(admin, "o1/r1/packet.json", 3600);
    expect(r?.expiresIn).toBe(DECISION_PACKET_SIGNED_URL_TTL_SECONDS);
    expect(createSignedUrl).toHaveBeenCalledWith(
      "o1/r1/packet.json",
      DECISION_PACKET_SIGNED_URL_TTL_SECONDS
    );
  });

  it("uploadDecisionPacketPdfArtifact uploads PDF when bucket set", async () => {
    process.env.V5_DECISION_PACKET_BUCKET = "packets";
    const upload = vi.fn(async () => ({ error: null }));
    const admin = {
      storage: {
        from: vi.fn(() => ({ upload })),
      },
    } as never;
    const r = await uploadDecisionPacketPdfArtifact(admin, {
      orgId: "o1",
      runId: "r1",
      pdfBuffer: Buffer.from("%PDF mock"),
    });
    if (r && 'error' in r) throw new Error(r.error);
    expect(r?.storagePath).toBe("o1/r1/packet.pdf");
    expect(upload).toHaveBeenCalledWith(
      "o1/r1/packet.pdf",
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf", upsert: true })
    );
  });
});
