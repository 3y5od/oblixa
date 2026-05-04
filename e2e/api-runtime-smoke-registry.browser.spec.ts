/**
 * Epic 7 — Optional Playwright GET probes for api-runtime-smoke registry rows (browser request API).
 * Enable: PLAYWRIGHT_API_SMOKE_REGISTRY=1 npx playwright test e2e/api-runtime-smoke-registry.browser.spec.ts
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_API_SMOKE_REGISTRY === "1" || process.env.PLAYWRIGHT_API_SMOKE_REGISTRY === "true";

test.describe.configure({ mode: "parallel" });

if (enabled) {
  test.describe("api-runtime-smoke registry browser probes @epic7", () => {
    const regPath = path.join(process.cwd(), "artifacts", "assurance", "api-runtime-smoke-registry.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8")) as {
      routes: Array<{ samplePath: string; runnerHint: string }>;
    };
    const rows = reg.routes.filter((r) => r.runnerHint === "public_or_token_surface").slice(0, 12);

    for (const row of rows) {
      test(`GET ${row.samplePath}`, async ({ request }) => {
        const res = await request.get(row.samplePath);
        const body = await res.text();
        expect.soft(res.status(), body.slice(0, 240)).toBeLessThan(500);
      });
    }
  });
}
