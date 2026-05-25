import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Tier-B proxy: high-traffic user text surfaces avoid raw HTML injection (V9 §5.3 / Appendix AQ). */
const USER_TEXT_COMPONENTS = [
  "src/components/contracts/contract-notes-panel.tsx",
  "src/components/contracts/exception-mutation-panels.tsx",
  "src/components/contracts/contract-evidence-requirements-panel.tsx",
];

describe("V9 user-generated text surfaces — no dangerouslySetInnerHTML on Core notes/evidence/exception panels", () => {
  it.each(USER_TEXT_COMPONENTS)("has no raw HTML sink in %s", (rel) => {
    const raw = readFileSync(join(process.cwd(), rel), "utf8");
    expect(raw).not.toContain("dangerouslySetInnerHTML");
  });
});
