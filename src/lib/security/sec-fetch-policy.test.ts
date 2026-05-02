import { describe, expect, it } from "vitest";
import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";

function req(method: string, site?: string): Request {
  const h = new Headers();
  if (site) h.set("sec-fetch-site", site);
  return new Request("https://app.example/api/x", { method, headers: h });
}

describe("secFetchSiteAllowsSensitiveMutation", () => {
  it("allows GET regardless of Sec-Fetch-Site", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("GET", "cross-site"))).toBe(true);
  });

  it("allows same-origin POST", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", "same-origin"))).toBe(true);
  });

  it("blocks cross-site POST", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST", "cross-site"))).toBe(false);
  });

  it("allows POST when header absent (non-browser clients)", () => {
    expect(secFetchSiteAllowsSensitiveMutation(req("POST"))).toBe(true);
  });
});
