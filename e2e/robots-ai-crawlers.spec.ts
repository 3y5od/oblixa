import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=robots_ai_bot_policy_optional

test.describe("robots.txt AI crawler hints", () => {
  test("robots.txt mentions common crawler policy tokens when present", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = (await res.text()).toLowerCase();
    const tokens = ["user-agent", "disallow", "allow"];
    for (const t of tokens) {
      expect(text).toContain(t);
    }
    for (const bot of ["gptbot", "oai-searchbot", "google-extended", "perplexitybot"]) {
      expect(text).toContain(bot);
    }
  });

  test("sitemap or llms.txt optional endpoints are non-5xx", async ({ request }) => {
    for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/llms.txt"] as const) {
      const res = await request.get(path);
      expect(res.status(), path).toBeLessThan(500);
    }
  });
});
