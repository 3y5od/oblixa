import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "@/lib/security/cron-auth";

const SECRET = "cron-secret-value";

describe("authorizeCronRequest", () => {
  it("accepts matching Bearer token", () => {
    const ok = authorizeCronRequest(
      new Request("http://localhost/api/cron/x", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
      SECRET
    );
    expect(ok).toBe(true);
  });

  it("accepts matching x-cron-secret", () => {
    const ok = authorizeCronRequest(
      new Request("http://localhost/api/cron/x", {
        headers: { "x-cron-secret": SECRET },
      }),
      SECRET
    );
    expect(ok).toBe(true);
  });

  it("trims x-cron-secret value", () => {
    const ok = authorizeCronRequest(
      new Request("http://localhost/api/cron/x", {
        headers: { "x-cron-secret": `  ${SECRET}  ` },
      }),
      SECRET
    );
    expect(ok).toBe(true);
  });

  it("rejects wrong secret and missing headers", () => {
    expect(
      authorizeCronRequest(
        new Request("http://localhost/", { headers: { authorization: "Bearer wrong" } }),
        SECRET
      )
    ).toBe(false);
    expect(authorizeCronRequest(new Request("http://localhost/"), SECRET)).toBe(false);
  });
});
