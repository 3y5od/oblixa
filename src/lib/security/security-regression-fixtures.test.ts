import { describe, expect, it } from "vitest";
import {
  getSecurityRegressionFixtures,
  SECURITY_REGRESSION_FIXTURES,
} from "@/lib/security/security-regression-fixtures";

describe("SECURITY_REGRESSION_FIXTURES", () => {
  it("covers reusable attack strings across parser and boundary tests", () => {
    expect(SECURITY_REGRESSION_FIXTURES.xssStrings.join("\n")).toContain("onerror");
    expect(SECURITY_REGRESSION_FIXTURES.sqlLikePayloads.join("\n")).toContain("DROP TABLE");
    expect(SECURITY_REGRESSION_FIXTURES.csvFormulas).toEqual(
      expect.arrayContaining([expect.stringMatching(/^=/), expect.stringMatching(/^\+/)])
    );
    expect(SECURITY_REGRESSION_FIXTURES.bidiStrings.join("")).toMatch(/[\u202a-\u202e\u2066-\u2069]/);
    expect(SECURITY_REGRESSION_FIXTURES.ssrfUrls.join("\n")).toContain("169.254.169.254");
    expect(SECURITY_REGRESSION_FIXTURES.badTokens).toEqual(expect.arrayContaining(["../etc/passwd"]));
    expect(SECURITY_REGRESSION_FIXTURES.badOrigins).toEqual(expect.arrayContaining(["null"]));
    expect(SECURITY_REGRESSION_FIXTURES.oversizedBodies.every((row) => row.bytes > 0)).toBe(true);
  });

  it("returns strongly named fixture families", () => {
    expect(getSecurityRegressionFixtures("csvFormulas")).toBe(SECURITY_REGRESSION_FIXTURES.csvFormulas);
    expect(getSecurityRegressionFixtures("badOrigins")).toBe(SECURITY_REGRESSION_FIXTURES.badOrigins);
  });
});
