import type { SupabaseClient } from "@supabase/supabase-js";

/** Guardrail for serverless memory when buffering packet bytes before upload. */
const MAX_DECISION_PACKET_UPLOAD_BYTES = 25 * 1024 * 1024;
export const DECISION_PACKET_SIGNED_URL_TTL_SECONDS = 5 * 60;

/** Private bucket name; create in Supabase Storage and set in server env. */
export function getDecisionPacketBucket(): string | null {
  const b = (process.env.DECISION_PACKET_BUCKET ?? process.env.V5_DECISION_PACKET_BUCKET ?? "").trim();
  return b.length > 0 ? b : null;
}

/** @deprecated Use getDecisionPacketBucket. */
export const getV5DecisionPacketBucket = getDecisionPacketBucket;

export function decisionPacketStoragePath(orgId: string, runId: string): string {
  return `${orgId}/${runId}/packet.json`;
}

export function decisionPacketPdfStoragePath(orgId: string, runId: string): string {
  return `${orgId}/${runId}/packet.pdf`;
}

export function normalizeDecisionPacketSignedUrlTtl(expiresInSeconds: number): number {
  const parsed = Math.floor(Number(expiresInSeconds));
  if (!Number.isFinite(parsed)) return DECISION_PACKET_SIGNED_URL_TTL_SECONDS;
  return Math.max(60, Math.min(DECISION_PACKET_SIGNED_URL_TTL_SECONDS, parsed));
}

export function isDecisionPacketArtifactStoragePathScoped(
  storagePath: string | null | undefined,
  params: { orgId: string; runId: string; artifact: "json" | "pdf" }
): boolean {
  const expected =
    params.artifact === "pdf"
      ? decisionPacketPdfStoragePath(params.orgId, params.runId)
      : decisionPacketStoragePath(params.orgId, params.runId);
  return storagePath === expected;
}

/**
 * Uploads JSON packet payload to object storage when `DECISION_PACKET_BUCKET` is set.
 * Failures are logged; callers treat null as non-fatal.
 */
export async function uploadDecisionPacketArtifact(
  admin: SupabaseClient,
  params: {
    orgId: string;
    runId: string;
    bytes: Uint8Array;
    contentType: string;
    extension: "json" | "pdf";
  }
): Promise<{ storagePath: string } | { error: string } | null> {
  const bucket = getDecisionPacketBucket();
  if (!bucket) return null;
  if (!admin.storage?.from) return null;
  if (params.bytes.byteLength > MAX_DECISION_PACKET_UPLOAD_BYTES) {
    console.error(
      "[decision-packet-storage] upload rejected: payload exceeds max bytes",
      params.bytes.byteLength
    );
    return { error: "Payload exceeds maximum size" };
  }

  const storagePath =
    params.extension === "pdf"
      ? decisionPacketPdfStoragePath(params.orgId, params.runId)
      : decisionPacketStoragePath(params.orgId, params.runId);

  const { error } = await admin.storage.from(bucket).upload(storagePath, params.bytes, {
    contentType: params.contentType,
    upsert: true,
  });

  if (error) {
    console.error("[decision-packet-storage] upload failed:", error.message);
    return null;
  }

  return { storagePath };
}

export async function uploadDecisionPacketJsonArtifact(
  admin: SupabaseClient,
  params: { orgId: string; runId: string; payload: Record<string, unknown> }
): Promise<{ storagePath: string } | { error: string } | null> {
  const body = JSON.stringify(params.payload, null, 2);
  const bytes = new TextEncoder().encode(body);
  return uploadDecisionPacketArtifact(admin, {
    orgId: params.orgId,
    runId: params.runId,
    bytes,
    contentType: "application/json; charset=utf-8",
    extension: "json",
  });
}

export async function uploadDecisionPacketPdfArtifact(
  admin: SupabaseClient,
  params: { orgId: string; runId: string; pdfBuffer: Buffer }
): Promise<{ storagePath: string } | { error: string } | null> {
  return uploadDecisionPacketArtifact(admin, {
    orgId: params.orgId,
    runId: params.runId,
    bytes: new Uint8Array(params.pdfBuffer),
    contentType: "application/pdf",
    extension: "pdf",
  });
}

export async function createDecisionPacketArtifactSignedUrl(
  admin: SupabaseClient,
  storagePath: string,
  expiresInSeconds = DECISION_PACKET_SIGNED_URL_TTL_SECONDS
): Promise<{ signedUrl: string; expiresIn: number } | null> {
  const bucket = getDecisionPacketBucket();
  if (!bucket) return null;
  if (!admin.storage?.from) return null;
  const safeExpiresIn = normalizeDecisionPacketSignedUrlTtl(expiresInSeconds);

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(storagePath, safeExpiresIn);

  if (error || !data?.signedUrl) {
    console.error("[decision-packet-storage] signed URL failed:", error?.message);
    return null;
  }

  return { signedUrl: data.signedUrl, expiresIn: safeExpiresIn };
}
