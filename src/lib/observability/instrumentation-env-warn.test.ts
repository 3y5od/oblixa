import { describe, expect, it } from "vitest";
import { hasProductionDebugMisconfiguration } from "@/lib/observability/instrumentation-env-warn";

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
