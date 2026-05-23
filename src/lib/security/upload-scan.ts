export type MalwareScannerMode = "disabled" | "test" | "required";
export type UploadMimeSniffResult =
  | { ok: true; mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
  | { ok: false; reason: "unknown_signature" };
export type UploadMalwareScanResult =
  | { ok: true; mode: MalwareScannerMode }
  | { ok: false; mode: MalwareScannerMode; reason: "malware_detected" | "scanner_unavailable" };

const EICAR_MARKER = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";

export function getMalwareScannerMode(env?: { OBLIXA_MALWARE_SCANNER_MODE?: string }): MalwareScannerMode {
  const source = env ?? (process.env as Record<string, string | undefined>);
  const raw = source.OBLIXA_MALWARE_SCANNER_MODE?.trim() || "disabled";
  if (raw === "disabled" || raw === "test" || raw === "required") return raw;
  return "required";
}

export function sniffUploadedFileMime(signature: Uint8Array): UploadMimeSniffResult {
  if (
    signature[0] === 0x25 &&
    signature[1] === 0x50 &&
    signature[2] === 0x44 &&
    signature[3] === 0x46 &&
    signature[4] === 0x2d
  ) {
    return { ok: true, mimeType: "application/pdf" };
  }
  if (
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(signature[2]) &&
    [0x04, 0x06, 0x08].includes(signature[3])
  ) {
    return {
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  return { ok: false, reason: "unknown_signature" };
}

export async function scanUploadedFileForMalware(
  file: File,
  mode: MalwareScannerMode = getMalwareScannerMode()
): Promise<UploadMalwareScanResult> {
  if (mode === "disabled") return { ok: true, mode };

  if (mode === "required") {
    return { ok: false, mode, reason: "scanner_unavailable" };
  }

  const prefix = await file.slice(0, 4096).text().catch(() => "");
  if (file.name.toLowerCase().includes("malware") || prefix.includes(EICAR_MARKER)) {
    return { ok: false, mode, reason: "malware_detected" };
  }
  return { ok: true, mode };
}
