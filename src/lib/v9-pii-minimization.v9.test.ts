import { describe, expect, it } from "vitest";
import { clampProductTelemetryDetails } from "@/lib/product-telemetry";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";
import { formatUnknownForServerLog, redactEmailLikeSubstrings } from "@/lib/observability/log-redaction";

describe("§5.3 + §28 PII minimization proxies", () => {
  it("keeps telemetry detail strings email-safe after clamping", () => {
    const out = clampProductTelemetryDetails({ x: "ping a@b.co ok" }).x;
    expect(typeof out === "string" && out.includes("[redacted]")).toBe(true);
    expect(out).not.toContain("@b.co");
  });

  it("scrubs Sentry-bound user + nested extras before send", () => {
    const out = scrubSentryEvent({
      request: { headers: {} },
      user: { email: "u@corp.test" },
      extra: { msg: "reach me@corp.test" },
    }) as { user?: { email?: string }; extra?: { msg?: string } };
    expect(out.user?.email).toBe("[redacted]");
    expect(out.extra?.msg).not.toContain("@corp.test");
  });

  it("formats structured server logs without echoing raw email tokens", () => {
    expect(formatUnknownForServerLog({ note: "ops@corp.test" })).not.toContain("@corp.test");
    expect(redactEmailLikeSubstrings("x@y.zz")).toBe("[redacted]");
  });
});
