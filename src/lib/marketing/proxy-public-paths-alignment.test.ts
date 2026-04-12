import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_INFORMATION_PATHS } from "@/lib/marketing/public-paths";

describe("proxy.ts vs public-paths (V7 §AP)", () => {
  it("delegates anonymous legal/marketing pages via proxy-path-policy (single source)", () => {
    const raw = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(raw).toContain("unauthenticatedAccessAllowed");
    expect(raw).toContain("@/lib/auth/proxy-path-policy");
    const policy = readFileSync(join(process.cwd(), "src/lib/auth/proxy-path-policy.ts"), "utf8");
    expect(policy).toContain("isPublicInformationPath");
    expect(policy).toContain("@/lib/marketing/public-paths");
    const canon = readFileSync(join(process.cwd(), "src/lib/marketing/public-paths.ts"), "utf8");
    for (const path of PUBLIC_INFORMATION_PATHS) {
      expect(canon, path).toContain(`"${path}"`);
    }
  });
});
