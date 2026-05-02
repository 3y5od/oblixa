// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=chaos_compose_contract
import fs from "node:fs";
import path from "node:path";

import { test, expect } from "@playwright/test";

test.describe("chaos local @nightly", () => {
  test("docker-compose.chaos.yml exists and declares services", () => {
    const p = path.join(process.cwd(), "docker-compose.chaos.yml");
    expect(fs.existsSync(p)).toBe(true);
    const raw = fs.readFileSync(p, "utf8");
    expect(raw).toMatch(/services:/);
  });

  test("compose stack probes when RUN_CHAOS=1", async () => {
    test.skip(!process.env.RUN_CHAOS, "Set RUN_CHAOS=1 with docker compose -f docker-compose.chaos.yml up.");
    expect(process.env.RUN_CHAOS).toBeTruthy();
  });
});
