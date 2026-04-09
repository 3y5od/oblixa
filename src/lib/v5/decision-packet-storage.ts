import type { SupabaseClient } from "@supabase/supabase-js";

/** Private bucket name; create in Supabase Storage and set in server env. */
export function getV5DecisionPacketBucket(): string | null {
  const b = (process.env.V5_DECISION_PACKET_BUCKET ?? "").trim();
  return b.length > 0 ? b : null;
}

export function decisionPacketStoragePath(orgId: string, runId: string): string {
  return `${orgId}/${runId}/packet.json`;
}

export function decisionPacketPdfStoragePath(orgId: string, runId: string): string {
  return `${orgId}/${runId}/packet.pdf`;
}

/**
 * Uploads JSON packet payload to object storage when `V5_DECISION_PACKET_BUCKET` is set.
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
): Promise<{ storagePath: string } | null> {
  const bucket = getV5DecisionPacketBucket();
  if (!bucket) return null;
  if (!admin.storage?.from) return null;

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
): Promise<{ storagePath: string } | null> {
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
): Promise<{ storagePath: string } | null> {
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
  expiresInSeconds = 3600
): Promise<{ signedUrl: string } | null> {
  const bucket = getV5DecisionPacketBucket();
  if (!bucket) return null;
  if (!admin.storage?.from) return null;

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error("[decision-packet-storage] signed URL failed:", error?.message);
    return null;
  }

  return { signedUrl: data.signedUrl };
}
