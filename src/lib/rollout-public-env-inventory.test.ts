import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_ROLLOUT_PUBLIC_ENV_KEYS } from "./rollout";

describe("V9 rollout kill switches (Appendix BI)", () => {
  it("lists every public V9 rollout env key in .env.example (non-secret contract)", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    for (const key of V9_ROLLOUT_PUBLIC_ENV_KEYS) {
      expect(example, key).toContain(key);
    }
  });

});
