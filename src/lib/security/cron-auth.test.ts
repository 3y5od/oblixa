import { describe, it, expect } from "vitest";
import { authorizeCronRequest } from "./cron-auth";

describe("authorizeCronRequest", () => {
  const secret = "test-cron-secret-value-32chars!!";

  it("accepts Authorization Bearer match", () => {
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(authorizeCronRequest(req, secret)).toBe(true);
  });

  it("accepts lowercase bearer prefix and extra whitespace", () => {
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: `bearer   ${secret}` },
    });
    expect(authorizeCronRequest(req, secret)).toBe(true);
  });

  it("rejects wrong bearer", () => {
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: "Bearer wrong" },
    });
    expect(authorizeCronRequest(req, secret)).toBe(false);
  });

  it("accepts x-cron-secret header", () => {
    const req = new Request("http://localhost/api/cron/x", {
      headers: { "x-cron-secret": secret },
    });
    expect(authorizeCronRequest(req, secret)).toBe(true);
  });

  it("accepts x-vercel-cron-secret header", () => {
    const req = new Request("http://localhost/api/cron/x", {
      headers: { "x-vercel-cron-secret": secret },
    });
    expect(authorizeCronRequest(req, secret)).toBe(true);
  });

  it("rejects missing credentials", () => {
    const req = new Request("http://localhost/api/cron/x");
    expect(authorizeCronRequest(req, secret)).toBe(false);
  });
});
