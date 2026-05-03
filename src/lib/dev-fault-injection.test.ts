import { afterEach, describe, expect, it } from "vitest";
import { maybeThrowFaultInjection, maybeThrowUpstreamFault } from "./dev-fault-injection";

describe("TEST_FAULT_INJECTION hook", () => {
  afterEach(() => {
    delete process.env.TEST_FAULT_INJECTION;
    delete process.env.TEST_FAULT_UPSTREAM_SUPABASE;
    delete process.env.TEST_FAULT_UPSTREAM_STRIPE;
    delete process.env.TEST_FAULT_UPSTREAM_OPENAI;
  });

  it("is inert when env unset", () => {
    expect(() => maybeThrowFaultInjection()).not.toThrow();
  });

  it("throws when TEST_FAULT_INJECTION=1", () => {
    process.env.TEST_FAULT_INJECTION = "1";
    expect(() => maybeThrowFaultInjection()).toThrow(/FAULT_INJECTION/);
  });
});

describe("upstream fault matrix (Epic 9)", () => {
  afterEach(() => {
    delete process.env.TEST_FAULT_UPSTREAM_SUPABASE;
    delete process.env.TEST_FAULT_UPSTREAM_STRIPE;
    delete process.env.TEST_FAULT_UPSTREAM_OPENAI;
  });

  it("throws for Supabase when TEST_FAULT_UPSTREAM_SUPABASE=1", () => {
    process.env.TEST_FAULT_UPSTREAM_SUPABASE = "1";
    expect(() => maybeThrowUpstreamFault("supabase")).toThrow(/UPSTREAM_FAULT:supabase/);
  });

  it("throws for Stripe when TEST_FAULT_UPSTREAM_STRIPE=1", () => {
    process.env.TEST_FAULT_UPSTREAM_STRIPE = "1";
    expect(() => maybeThrowUpstreamFault("stripe")).toThrow(/UPSTREAM_FAULT:stripe/);
  });
});
