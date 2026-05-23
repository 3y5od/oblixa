import { describe, expect, it } from "vitest";
import {
  contentDispositionAttachment,
  contentDispositionInline,
  sanitizeExportFileName,
  sanitizeExportFileNameToken,
} from "@/lib/security/export-filename";

describe("sanitizeExportFileName", () => {
  it("uses the basename after path separators", () => {
    expect(sanitizeExportFileName("../../contracts.csv")).toBe("contracts.csv");
    expect(sanitizeExportFileName("a\\b\\calendar.ics")).toBe("calendar.ics");
  });

  it("strips header-breaking and bidi characters", () => {
    expect(sanitizeExportFileName("bad\r\nname.csv")).toBe("badname.csv");
    expect(sanitizeExportFileName("invoice\u202Ecod.exe.csv")).toBe("invoicecod.exe.csv");
    expect(sanitizeExportFileName('semi;quoteslash.csv')).toBe("semiquoteslash.csv");
    expect(sanitizeExportFileName("report%0d%0aX-Bad.csv")).toBe("report0d0aX-Bad.csv");
  });

  it("falls back and caps length", () => {
    expect(sanitizeExportFileName("\u202E\r\n")).toBe("export");
    expect(sanitizeExportFileName(".csv")).toBe("csv");
    expect(sanitizeExportFileName(`${"a".repeat(200)}.csv`).length).toBe(120);
  });

  it("creates bounded filename tokens for route ids", () => {
    expect(sanitizeExportFileNameToken("../bad\r\nname.")).toBe("badname");
    expect(sanitizeExportFileNameToken("\r\n.")).toBe("export");
    expect(sanitizeExportFileNameToken(`${"a".repeat(200)}.csv`).length).toBe(80);
  });

  it("builds RFC 5987 attachment headers with ASCII fallback", () => {
    expect(contentDispositionAttachment("contracts export.csv")).toBe(
      `attachment; filename="contracts export.csv"; filename*=UTF-8''contracts%20export.csv`
    );
    expect(contentDispositionAttachment("résumé.csv")).toBe(
      `attachment; filename="resume.csv"; filename*=UTF-8''r%C3%A9sum%C3%A9.csv`
    );
  });

  it("builds inline content disposition headers with sanitized filenames", () => {
    expect(contentDispositionInline("report\r\npack.html")).toBe(
      `inline; filename="reportpack.html"; filename*=UTF-8''reportpack.html`
    );
  });
});
