import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 error boundary isolation (§22.4)", () => {
  it("dashboard segment keeps route error boundary separate from root app error", () => {
    expect(existsSync(join(process.cwd(), "src/app/(dashboard)/error.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/error.tsx"))).toBe(true);
  });
});
