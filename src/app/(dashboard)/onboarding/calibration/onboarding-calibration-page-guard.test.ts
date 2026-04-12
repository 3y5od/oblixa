import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("onboarding calibration page guards (static)", () => {
  it("sends unauthenticated users to login and non-admins to dashboard", () => {
    const file = join(
      process.cwd(),
      "src/app/(dashboard)/onboarding/calibration/page.tsx"
    );
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain('redirect("/login")');
    expect(raw).toContain('redirect("/dashboard")');
  });
});
