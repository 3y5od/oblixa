import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CHECKOUT = join(process.cwd(), "src/app/api/stripe/checkout/route.ts");
const PORTAL = join(process.cwd(), "src/app/api/stripe/portal/route.ts");

describe("Stripe checkout/portal return URLs (V7 billing surface)", () => {
  it("keeps success and cancel targets on settings/billing (no Advanced/Assurance hubs)", () => {
    const checkout = readFileSync(CHECKOUT, "utf8");
    expect(checkout).toContain("success_url:");
    // SPEC: docs/billing-page-maximal-pass.md §1.1 + §1.22 — sentinel
    // changed from ?success=true to ?success=1&session_id={CHECKOUT_SESSION_ID}
    expect(checkout).toContain(
      "/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}"
    );
    expect(checkout).toContain("/settings/billing?canceled=1");
    expect(checkout).not.toMatch(/success_url:[^\n]*\/decisions/);
    expect(checkout).not.toMatch(/success_url:[^\n]*\/assurance/);

    const portal = readFileSync(PORTAL, "utf8");
    expect(portal).not.toMatch(/return_url:[^\n]*\/decisions/);
    expect(portal).not.toMatch(/return_url:[^\n]*\/campaigns/);
  });
});
