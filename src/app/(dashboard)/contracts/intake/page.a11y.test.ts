import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/intake/page.tsx");

describe("contracts intake page accessibility", () => {
  it("keeps repeated row intake controls named", () => {
    const raw = readFileSync(PAGE, "utf8");

    expect(raw).toContain('aria-label={`Intake status for ${String(row.title ?? "contract")}`}');
    expect(raw).toContain('aria-label={`Completeness score for ${String(row.title ?? "contract")}`}');
  });
});
