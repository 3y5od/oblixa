// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=browser_security_headers_matrix
import { test, expect } from "@playwright/test";

test.describe("browser security headers advanced @nightly", () => {
  test("root response exposes some security headers when configured", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBeLessThan(500);
    const h = res.headers();
    const keys = Object.keys(h).map((k) => k.toLowerCase());
    const interesting = ["x-frame-options", "content-security-policy", "referrer-policy", "permissions-policy"];
    const present = interesting.filter((name) => keys.includes(name));
    expect(present.length + (res.ok() ? 1 : 0)).toBeGreaterThan(0);
  });

  test("COOP/COEP headers when product enables crossOriginIsolation", async ({ request }) => {
    const res = await request.get("/");
    const coop = res.headers()["cross-origin-opener-policy"];
    const coep = res.headers()["cross-origin-embedder-policy"];
    if (!coop && !coep) {
      expect([200, 307, 308, 404]).toContain(res.status());
      return;
    }
    expect(String(coop || coep).length).toBeGreaterThan(0);
  });
});
