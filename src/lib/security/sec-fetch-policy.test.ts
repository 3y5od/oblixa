import { describe, expect, it } from "vitest";
import { hasMethodOverrideAttempt, secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";

function req(method: string, input?: { site?: string; origin?: string; referer?: string; headers?: Record<string, string>; url?: string }): Request {
  const h = new Headers();
  if (input?.site) h.set("sec-fetch-site", input.site);
  if (input?.origin) h.set("origin", input.origin);
  if (input?.referer) h.set("referer", input.referer);
  for (const [key, value] of Object.entries(input?.headers ?? {})) h.set(key, value);
  return new Request(input?.url ?? "https://app.example/api/x", { method, headers: h });
}

describe("secFetchSiteAllowsSensitiveMutation", () => {
  it("allows GET regardless of Sec-Fetch-Site", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("GET", { site: "cross-site" }))).toBe(true);
  });

  it("allows same-origin POST", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { site: "same-origin" }))).toBe(true);
  });

  it("blocks cross-site POST", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { site: "cross-site" }))).toBe(false);
  });

  it("blocks POST when browser-origin metadata is absent", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST"))).toBe(false);
  });

  it("blocks cross-site Origin values", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { origin: "https://evil.example" }))).toBe(false);
  });

  it("allows same-origin Origin values", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { origin: "https://app.example" }))).toBe(true);
  });

  it("blocks hostile Referer when Origin is absent", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { referer: "https://evil.example/form" }))).toBe(false);
  });

  it("allows same-origin Referer when Origin is absent", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { referer: "https://app.example/settings" }))).toBe(true);
  });

  it("allows explicit browser user activation requests", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { site: "none" }))).toBe(true);
  });

  it("blocks malformed Origin and Referer values", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { origin: "not a url" }))).toBe(false);
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", { referer: "not a url" }))).toBe(false);
  });

  it("blocks cross-site form-style submissions", () => {
    expect(
      secFetchSiteAllowsSensitiveMutation(
        req("POST", {
          origin: "https://evil.example",
          site: "cross-site",
        })
      )
    ).toBe(false);
  });
});

describe("hasMethodOverrideAttempt", () => {
  it("rejects method override headers", () => {
    expect(hasMethodOverrideAttempt(req("POST", { headers: { "x-http-method-override": "DELETE" } }))).toBe(true);
    expect(hasMethodOverrideAttempt(req("POST", { headers: { "x-method-override": "PATCH" } }))).toBe(true);
    expect(hasMethodOverrideAttempt(req("POST", { headers: { "x-http-method": "PUT" } }))).toBe(true);
  });

  it("rejects method override query parameters", () => {
    expect(hasMethodOverrideAttempt(req("GET", { url: "https://app.example/api/x?_method=DELETE" }))).toBe(true);
    expect(hasMethodOverrideAttempt(req("GET", { url: "https://app.example/api/x?httpMethod=PATCH" }))).toBe(true);
  });

  it("allows normal API requests without override signals", () => {
    expect(hasMethodOverrideAttempt(req("POST", { url: "https://app.example/api/x?format=json" }))).toBe(false);
  });
});
