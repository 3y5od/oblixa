import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tier C matrix — V9-critical import / export / evidence route handlers each ship a colocated route.test.ts.
 */
describe("V9 API matrix — import / export / evidence route tests on disk", () => {
  const root = join(process.cwd(), "src/app/api");

  const pairs: Array<{ route: string; test: string }> = [
    { route: "import/contracts/route.ts", test: "import/contracts/route.test.ts" },
    { route: "import/contracts/[jobId]/route.ts", test: "import/contracts/[jobId]/route.test.ts" },
    { route: "export/contracts/route.ts", test: "export/contracts/route.test.ts" },
    { route: "export/contracts/[jobId]/route.ts", test: "export/contracts/[jobId]/route.test.ts" },
    { route: "evidence/[id]/[action]/route.ts", test: "evidence/[id]/[action]/route.test.ts" },
    { route: "evidence/submit/route.ts", test: "evidence/submit/route.test.ts" },
    { route: "evidence/export/[contractId]/route.ts", test: "evidence/export/[contractId]/route.test.ts" },
  ];

  it.each(pairs)("has handler and test for $route", ({ route, test }) => {
    const routeAbs = join(root, route);
    const testAbs = join(root, test);
    expect(existsSync(routeAbs), routeAbs).toBe(true);
    expect(existsSync(testAbs), testAbs).toBe(true);
  });
});
