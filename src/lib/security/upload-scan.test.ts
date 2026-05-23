import { describe, expect, it } from "vitest";
import {
  getMalwareScannerMode,
  scanUploadedFileForMalware,
  sniffUploadedFileMime,
} from "@/lib/security/upload-scan";

describe("upload-scan", () => {
  it("sniffs supported upload MIME types from file signatures", () => {
    expect(sniffUploadedFileMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toEqual({
      ok: true,
      mimeType: "application/pdf",
    });
    expect(sniffUploadedFileMime(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toEqual({
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(sniffUploadedFileMime(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toEqual({
      ok: false,
      reason: "unknown_signature",
    });
  });

  it("supports disabled, test, and fail-closed required scanner modes", async () => {
    expect(getMalwareScannerMode({ OBLIXA_MALWARE_SCANNER_MODE: "disabled" })).toBe("disabled");
    expect(getMalwareScannerMode({ OBLIXA_MALWARE_SCANNER_MODE: "test" })).toBe("test");
    expect(getMalwareScannerMode({ OBLIXA_MALWARE_SCANNER_MODE: "unexpected" })).toBe("required");

    const cleanFile = new File(["%PDF-1.7 clean"], "clean.pdf", { type: "application/pdf" });
    await expect(scanUploadedFileForMalware(cleanFile, "disabled")).resolves.toEqual({
      ok: true,
      mode: "disabled",
    });
    await expect(scanUploadedFileForMalware(cleanFile, "required")).resolves.toEqual({
      ok: false,
      mode: "required",
      reason: "scanner_unavailable",
    });

    const eicarFile = new File(["X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE"], "sample.pdf", {
      type: "application/pdf",
    });
    await expect(scanUploadedFileForMalware(eicarFile, "test")).resolves.toEqual({
      ok: false,
      mode: "test",
      reason: "malware_detected",
    });
  });
});
