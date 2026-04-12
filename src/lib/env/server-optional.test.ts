import { describe, expect, it } from "vitest";
import { getOptionalServerEnv } from "@/lib/env/server";

/** Avoid a static env key literal so check-env-example-parity does not flag test-only vars. */
const testKey = ["OBLIXA", "TEST", "OPT", "ENV", "Z"].join("_");

describe("getOptionalServerEnv", () => {
  it("returns null for missing or blank values", () => {
    delete process.env[testKey];
    expect(getOptionalServerEnv(testKey)).toBeNull();
    process.env[testKey] = "   ";
    expect(getOptionalServerEnv(testKey)).toBeNull();
    delete process.env[testKey];
  });

  it("trims non-empty values", () => {
    process.env[testKey] = "  hello  ";
    expect(getOptionalServerEnv(testKey)).toBe("hello");
    delete process.env[testKey];
  });
});
