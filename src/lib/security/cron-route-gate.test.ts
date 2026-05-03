import { afterEach, describe, expect, it } from "vitest";
import { gateCronRequest, isCronUnsignedRejectStatus, respondCronMissingEnv } from "./cron-route-gate";

describe("cron-route-gate", () => {
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("isCronUnsignedRejectStatus accepts 401 and 503", () => {
    expect(isCronUnsignedRejectStatus(401)).toBe(true);
    expect(isCronUnsignedRejectStatus(503)).toBe(true);
    expect(isCronUnsignedRejectStatus(200)).toBe(false);
  });

  it("gateCronRequest returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const res = gateCronRequest(new Request("https://example.test/api/cron/x"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    const body = await res!.json();
    expect(body.code).toBe("cron_secret_missing");
    expect(body.diagnostic_id).toBe("cron_secret_missing");
    expect(body.route).toBe("/api/cron/x");
  });

  it("gateCronRequest returns 401 when secret set but request unsigned", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const res = gateCronRequest(new Request("https://example.test/api/cron/x"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body.diagnostic_id).toBe("cron_unauthorized");
    expect(body.route).toBe("/api/cron/x");
  });

  it("gateCronRequest returns null when Bearer matches", () => {
    process.env.CRON_SECRET = "s3cr3t";
    const res = gateCronRequest(
      new Request("https://example.test/api/cron/x", {
        headers: { Authorization: "Bearer s3cr3t" },
      })
    );
    expect(res).toBeNull();
  });

  it("respondCronMissingEnv includes stable code", async () => {
    const res = respondCronMissingEnv();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("cron_secret_missing");
    expect(body.missing_env).toBe("CRON_SECRET");
  });
});
