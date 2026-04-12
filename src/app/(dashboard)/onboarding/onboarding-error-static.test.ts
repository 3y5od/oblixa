import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("onboarding error.tsx", () => {
  it("exposes reset, Dashboard link, and Wave 2 tokens", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/onboarding/error.tsx"), "utf8");
    expect(raw).toContain("Try again");
    expect(raw).toContain('href="/dashboard"');
    expect(raw).toContain("ui-card");
    expect(raw).toContain("ui-btn-secondary");
    expect(raw).toContain("ui-btn-primary");
    expect(raw).toContain("reset");
  });
});
