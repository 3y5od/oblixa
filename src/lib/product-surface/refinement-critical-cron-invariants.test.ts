import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/refinement.md §18.2–18.4 — scheduled send paths must respect org notification policy
 * or pass workspace mode into copy degradation (regression tripwire if a route is refactored away).
 */
const ROOT = join(process.cwd(), "src", "app", "api");

describe("refinement §18 cron / bulk send routes", () => {
  it("consult org settings JSON and/or notification policy on tier-sensitive crons", () => {
    const checks: { rel: string; mustInclude: string[] }[] = [
      {
        rel: "reports/send-summaries/route.ts",
        mustInclude: ["getV6OrgSettingsJson", "isNotificationAllowed"],
      },
      {
        rel: "cron/v4/report-packs-generate/route.ts",
        mustInclude: ["getV6OrgSettingsJson"],
      },
      {
        rel: "reminders/send/route.ts",
        mustInclude: ["isNotificationAllowed"],
      },
    ];
    for (const { rel, mustInclude } of checks) {
      const raw = readFileSync(join(ROOT, rel), "utf8");
      for (const s of mustInclude) {
        expect(raw.includes(s), `${rel} must include ${s}`).toBe(true);
      }
    }
  });
});
