import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=gdpr_artifact_contract

test.describe("GDPR / legal-hold artifact contract", () => {
  test("legal-hold-adapter.json parses", async () => {
    const raw = await readFile(path.join(process.cwd(), "artifacts", "legal-hold-adapter.json"), "utf8").catch(
      () => null
    );
    if (!raw) {
      test.skip(true, "legal-hold-adapter.json missing");
      return;
    }
    const j = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(j).length).toBeGreaterThan(0);
  });

  test("privacy policy route is reachable for GDPR surface smoke", async ({ request }) => {
    const res = await request.get("/privacy");
    expect(res.status()).toBeLessThan(500);
  });
});
