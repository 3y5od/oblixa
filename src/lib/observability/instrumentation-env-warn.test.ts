import { describe, expect, it } from "vitest";
import {
  hasProductionDebugMisconfiguration,
  listStrictProductionSecretDeficits,
} from "@/lib/observability/instrumentation-env-warn";

describe("hasProductionDebugMisconfiguration", () => {
  it("is false outside production", () => {
    expect(
      hasProductionDebugMisconfiguration({
        NODE_ENV: "development",
        DEBUG: "1",
      } as NodeJS.ProcessEnv)
    ).toBe(false);
  });

  it("is true in production when DEBUG is set", () => {
    expect(
      hasProductionDebugMisconfiguration({
        NODE_ENV: "production",
        DEBUG: "1",
      } as NodeJS.ProcessEnv)
    ).toBe(true);
  });

  it("detects --inspect in NODE_OPTIONS", () => {
    expect(
      hasProductionDebugMisconfiguration({
        NODE_ENV: "production",
        NODE_OPTIONS: " --inspect ",
      } as NodeJS.ProcessEnv)
    ).toBe(true);
  });
});

describe("listStrictProductionSecretDeficits", () => {
  it("is empty unless production with OBLIXA_STRICT_ENV=1", () => {
    expect(
      listStrictProductionSecretDeficits({
        NODE_ENV: "development",
        OBLIXA_STRICT_ENV: "1",
      } as NodeJS.ProcessEnv)
    ).toEqual([]);
    expect(
      listStrictProductionSecretDeficits({
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv)
    ).toEqual([]);
  });

  it("lists missing core secrets when strict", () => {
    const out = listStrictProductionSecretDeficits({
      NODE_ENV: "production",
      OBLIXA_STRICT_ENV: "1",
      STRIPE_SECRET_KEY: "sk_test_x",
    } as NodeJS.ProcessEnv);
    expect(out).toEqual(
      expect.arrayContaining([
        "SUPABASE_SERVICE_ROLE_KEY",
        "CRON_SECRET",
        "STRIPE_WEBHOOK_SECRET",
        "EXTERNAL_ACTION_PASSCODE_PEPPER",
        "EXTERNAL_ACTION_SUBMIT_TICKET_SECRET",
      ])
    );
  });

  it("does not require external-action secrets when external collaboration is disabled", () => {
    const out = listStrictProductionSecretDeficits({
      NODE_ENV: "production",
      OBLIXA_STRICT_ENV: "1",
      ENABLE_V5_EXTERNAL_COLLABORATION: "false",
      SUPABASE_SERVICE_ROLE_KEY: "sr",
      CRON_SECRET: "c",
      STRIPE_SECRET_KEY: "",
      EXTERNAL_ACTION_PASSCODE_PEPPER: "",
      EXTERNAL_ACTION_SUBMIT_TICKET_SECRET: "",
    } as NodeJS.ProcessEnv);
    expect(out).not.toContain("EXTERNAL_ACTION_PASSCODE_PEPPER");
    expect(out).not.toContain("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET");
  });
});
