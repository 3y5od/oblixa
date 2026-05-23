import { describe, expect, it } from "vitest";

import { isSensitiveUrlParamName, stripSensitiveUrlParams, urlContainsSensitiveParams } from "./sensitive-url";

describe("sensitive-url", () => {
  it("detects common token, signature, and private URL parameter names", () => {
    expect(isSensitiveUrlParamName("token")).toBe(true);
    expect(isSensitiveUrlParamName("access-token")).toBe(true);
    expect(isSensitiveUrlParamName("private_url")).toBe(true);
    expect(isSensitiveUrlParamName("page")).toBe(false);
  });

  it("strips sensitive query params while preserving safe params and hashes", () => {
    expect(stripSensitiveUrlParams("/contracts?token=raw&page=2&signature=abc#row")).toBe("/contracts?page=2#row");
    expect(stripSensitiveUrlParams("/reports?filter=open&sort=due")).toBe("/reports?filter=open&sort=due");
  });

  it("reports URLs that contain sensitive query params", () => {
    expect(urlContainsSensitiveParams("/external/abc?token=raw")).toBe(true);
    expect(urlContainsSensitiveParams("/external/abc?view=public")).toBe(false);
  });
});
