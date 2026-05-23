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

  it("accepts previous cron secret during rotation", () => {
    const previous = "previous-cron-secret-value-32chars";
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: `Bearer ${previous}` },
    });
    expect(authorizeCronRequest(req, secret, previous, "2099-01-01T00:00:00.000Z")).toBe(true);
  });

  it("rejects expired previous cron secret", () => {
    const previous = "previous-cron-secret-value-32chars";
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: `Bearer ${previous}` },
    });
    expect(authorizeCronRequest(req, secret, previous, "2000-01-01T00:00:00.000Z")).toBe(false);
  });

  it("rejects missing credentials", () => {
    const req = new Request("http://localhost/api/cron/x");
    expect(authorizeCronRequest(req, secret)).toBe(false);
  });
});
