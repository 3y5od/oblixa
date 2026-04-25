/**
 * V9 §20.2 — EmptyState exposes a single `action` slot; authors compose ≤2 CTAs inside that fragment.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("EmptyState CTA budget primitive (V9 §20.2)", () => {
  it("uses one optional action region (not unbounded props)", () => {
    const raw = readFileSync(join(process.cwd(), "src/components/ui/empty-state.tsx"), "utf8");
    expect(raw).toMatch(/action\?: ReactNode/);
    expect(raw).not.toMatch(/secondaryAction|tertiaryAction/);
  });
});
