import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC: docs/billing-page-refinement-pass.md §14.21 — invoice PDF
// freshness proxy. Surface-level pins; full integration test would need
// the existing Stripe mock harness from
// src/app/api/stripe/checkout/route.test.ts.

const SRC = readFileSync(
  join(process.cwd(), "src/app/api/stripe/invoices/[id]/pdf/route.ts"),
  "utf8"
);

describe("/api/stripe/invoices/[id]/pdf — proxy pins (§14.21)", () => {
  it("declares runtime nodejs (Stripe SDK is Node-only)", () => {
    expect(SRC).toContain('export const runtime = "nodejs"');
  });

  it("validates invoice id prefix in_*", () => {
    expect(SRC).toContain('id.startsWith("in_")');
  });

  it("requires authentication", () => {
    expect(SRC).toContain("supabase.auth.getUser()");
    expect(SRC).toContain("jsonUnauthorized");
  });

  it("requires admin role", () => {
    expect(SRC).toContain('membership.role !== "admin"');
    expect(SRC).toContain("jsonForbidden");
  });

  it("performs ownership check against org.stripe_customer_id", () => {
    expect(SRC).toContain("orgRow.stripe_customer_id");
    expect(SRC).toContain("invoiceCustomer !== orgRow.stripe_customer_id");
  });

  it("returns 302 with Location header on success", () => {
    expect(SRC).toContain("status: 302");
    expect(SRC).toContain("Location: invoice.invoice_pdf");
  });

  it("sets Cache-Control no-store + Referrer-Policy headers", () => {
    expect(SRC).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(SRC).toContain('"Referrer-Policy"');
  });

  it("logs Stripe error.requestId for support traceability", () => {
    expect(SRC).toContain("requestId: stripeErr.requestId");
  });
});
