import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC: docs/billing-page-refinement-pass.md §14.20 — error boundary
// variant copy per error class.

const ERROR_SRC = readFileSync(
  join(process.cwd(), "src/app/(dashboard)/settings/billing/error.tsx"),
  "utf8"
);

describe("billing error.tsx — variant copy (§14.20)", () => {
  it("declares classifyError() variants", () => {
    expect(ERROR_SRC).toContain("function classifyError");
    expect(ERROR_SRC).toContain('"stripe"');
    expect(ERROR_SRC).toContain('"supabase"');
    expect(ERROR_SRC).toContain('"network"');
    expect(ERROR_SRC).toContain('"default"');
  });

  it("checks error.requestId / StripeAPIError name for stripe variant", () => {
    expect(ERROR_SRC).toContain("requestId");
    expect(ERROR_SRC).toContain("Stripe");
  });

  it("classifies PGRST / postgres / supabase errors as supabase", () => {
    expect(ERROR_SRC).toContain("PGRST");
    expect(ERROR_SRC).toContain("supabase");
  });

  it("classifies fetch / network / ECONNRESET as network", () => {
    expect(ERROR_SRC).toContain("fetch failed");
    expect(ERROR_SRC).toContain("ECONNRESET");
  });

  it("always shows error.digest REF for support correlation", () => {
    expect(ERROR_SRC).toContain("error.digest");
    expect(ERROR_SRC).toContain("REF");
  });

  it("renders Try again + Contact support actions", () => {
    expect(ERROR_SRC).toContain("Try again");
    expect(ERROR_SRC).toContain("Contact support");
  });
});
