import { describe, expect, it } from "vitest";
import {
  buildOperationalSpanContract,
  hashOperationalIdentifier,
  OPERATIONAL_SPAN_KINDS,
  sanitizeOperationalSpanAttributes,
  withOperationalSpan,
} from "@/lib/observability/operational-span";

describe("OpenTelemetry operational span wrapper contract", () => {
  it("builds stable names for API routes, cron routes, webhooks, provider calls, and background jobs", () => {
    const operations = [
      ["api_route", "/api/contracts/[id]"],
      ["cron_route", "/api/cron/read-model-refresh"],
      ["webhook", "stripe.webhook.event"],
      ["provider_call", "openai.extract.fields"],
      ["background_job", "report-pack-generate"],
    ] as const;

    expect(operations.map(([kind, operation]) => buildOperationalSpanContract({ kind, operation }).name)).toEqual([
      "oblixa.api_route.api.contracts.id",
      "oblixa.cron_route.api.cron.read.model.refresh",
      "oblixa.webhook.stripe.webhook.event",
      "oblixa.provider_call.openai.extract.fields",
      "oblixa.background_job.report.pack.generate",
    ]);
    expect(OPERATIONAL_SPAN_KINDS).toEqual(operations.map(([kind]) => kind));
  });

  it("hashes org and user ids while redacting sensitive attributes", () => {
    const span = buildOperationalSpanContract({
      kind: "provider_call",
      operation: "openai.extract.fields",
      orgId: "org_secret_123",
      userId: "user@example.test",
      provider: "openai",
      status: 503,
      durationMs: 42.9,
      attributes: {
        organization_id: "org_secret_123",
        user_id: "user@example.test",
        authorization: "Bearer abcdefghijk123456789",
        raw_provider_payload: { message: "private" },
        safe_reason: "provider timeout",
      },
    });

    const text = JSON.stringify(span);
    expect(span.attributes.org_id_hash).toBe(hashOperationalIdentifier("org_secret_123"));
    expect(span.attributes.user_id_hash).toBe(hashOperationalIdentifier("user@example.test"));
    expect(span.attributes.status_class).toBe("5xx");
    expect(span.attributes.duration_ms).toBe(42);
    expect(span.attributes.provider).toBe("openai");
    expect(span.attributes.authorization).toBe("[redacted]");
    expect(span.attributes.raw_provider_payload).toBe("[redacted]");
    expect(span.attributes.safe_reason).toBe("provider timeout");
    expect(text).not.toContain("org_secret_123");
    expect(text).not.toContain("user@example.test");
    expect(text).not.toContain("abcdefghijk");
  });

  it("sanitizes attribute arrays and objects without leaking raw values", () => {
    const attributes = sanitizeOperationalSpanAttributes({
      tags: ["ok", "owner@example.test"],
      payload: { token: "secret" },
      attempts: 2,
    });
    expect(attributes.tags).toEqual(["ok", "[redacted]"]);
    expect(attributes.payload).toBe("[redacted]");
    expect(attributes.attempts).toBe(2);
  });

  it("emits sanitized spans for success and error paths", async () => {
    const emitted: ReturnType<typeof buildOperationalSpanContract>[] = [];
    await expect(
      withOperationalSpan(
        { kind: "background_job", operation: "runtime-artifact-cleanup", jobId: "job_1" },
        async () => "done",
        (span) => emitted.push(span)
      )
    ).resolves.toBe("done");

    await expect(
      withOperationalSpan(
        { kind: "webhook", operation: "stripe.webhook", attributes: { webhook_secret: "whsec_private" } },
        async () => {
          throw new TypeError("bad webhook");
        },
        (span) => emitted.push(span)
      )
    ).rejects.toThrow("bad webhook");

    expect(emitted[0]).toMatchObject({
      name: "oblixa.background_job.runtime.artifact.cleanup",
      attributes: { job_id: "job_1", status: "ok" },
    });
    expect(emitted[1]).toMatchObject({
      name: "oblixa.webhook.stripe.webhook",
      attributes: { status: "error", error_class: "TypeError", webhook_secret: "[redacted]" },
    });
  });
});
