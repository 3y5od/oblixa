import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/app/api/stripe/invoices/route.ts"), "utf8");

describe("/api/stripe/invoices route contract", () => {
  it("requires authenticated admin access before Stripe invoice reads", () => {
    expect(SRC).toContain("supabase.auth.getUser()");
    expect(SRC).toContain("getDeterministicMembership");
    expect(SRC).toContain('membership.role !== "admin"');
    expect(SRC).toContain("jsonForbidden");
  });

  it("rate limits the authenticated workspace invoice list", () => {
    expect(SRC).toContain("rateLimitCheck");
    expect(SRC).toContain("stripe-invoices:${user.id}:${ip}");
    expect(SRC).toContain("jsonRateLimited");
  });

  it("keeps billing provider reads private and no-store", () => {
    expect(SRC).toContain("getStripeClient");
    expect(SRC).toContain('"Cache-Control", "no-store, max-age=0"');
    expect(SRC).toContain('"X-Frame-Options", "DENY"');
  });
});
