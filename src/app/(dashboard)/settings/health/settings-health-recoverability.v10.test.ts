import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/settings/health/page.tsx");

describe("settings health recoverability coverage (V10)", () => {
  it("keeps reminder and API route health sections visible on the workspace health surface", () => {
    const raw = readFileSync(PAGE, "utf8");
    expect(raw).toContain("Recent reminder runs");
    expect(raw).toContain("API route health");
    expect(raw).toContain("Critical product path hooks");
    expect(raw).toContain('/api/notifications/retry-deliveries');
    expect(raw).toContain("Review renewals");
  });
});