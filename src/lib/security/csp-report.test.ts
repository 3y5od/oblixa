import { describe, expect, it } from "vitest";
import { formatCspReportForSecurityLog, normalizeCspReportBody } from "@/lib/security/csp-report";

describe("csp-report", () => {
  it("normalizes legacy csp-report bodies", () => {
    const report = normalizeCspReportBody({
      "csp-report": {
        "document-uri": "https://app.example.com/dashboard?token=secret-token-value",
        "blocked-uri": "inline",
        "violated-directive": "script-src 'self'",
        "effective-directive": "script-src",
        disposition: "enforce",
        "status-code": 200,
      },
    });
    expect(report).toMatchObject({
      blockedUri: "inline",
      violatedDirective: "script-src 'self'",
      effectiveDirective: "script-src",
      disposition: "enforce",
      statusCode: 200,
    });
    expect(formatCspReportForSecurityLog(report!)).not.toContain("secret-token-value");
  });

  it("normalizes reporting-api csp-violation envelopes", () => {
    const report = normalizeCspReportBody([
      {
        type: "csp-violation",
        body: {
          documentURL: "https://app.example.com/",
          blockedURL: "https://cdn.example.com/a.js",
          effectiveDirective: "script-src",
          disposition: "report",
          statusCode: 200,
        },
      },
    ]);
    expect(report).toMatchObject({
      documentUri: "https://app.example.com/",
      blockedUri: "https://cdn.example.com/a.js",
      effectiveDirective: "script-src",
      disposition: "report",
    });
  });

  it("rejects bodies without a directive", () => {
    expect(normalizeCspReportBody({ "blocked-uri": "inline" })).toBeNull();
  });

  it("rejects control characters in directive fields", () => {
    expect(normalizeCspReportBody({ "violated-directive": "script-src\r\nx: y" })).toBeNull();
  });
});
