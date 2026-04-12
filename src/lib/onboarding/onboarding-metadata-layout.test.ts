import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LAYOUT = join(process.cwd(), "src/app/(dashboard)/onboarding/layout.tsx");

describe("onboarding layout metadata (robots noindex)", () => {
  it("exports metadata with robots index false", () => {
    const raw = readFileSync(LAYOUT, "utf8");
    expect(raw).toMatch(/export const metadata/);
    expect(raw).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(raw).toMatch(/follow:\s*false/);
    expect(raw).toMatch(/bg-canvas/);
    expect(raw).toMatch(/motion-reduce:transition-none/);
  });
});
