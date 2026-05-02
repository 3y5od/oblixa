import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("Next cache / RSC invariants", () => {
  it("documents absence of unstable_cache / revalidateTag in application src (spot)", () => {
    const hits: string[] = [];

    function scanFile(abs: string) {
      const raw = fs.readFileSync(abs, "utf8");
      if (/\bunstable_cache\b/.test(raw) || /\brevalidateTag\b/.test(raw)) hits.push(abs);
    }

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) {
          if (name === "node_modules" || name === ".next") continue;
          walk(p);
        } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
          scanFile(p);
        }
      }
    }

    for (const r of ["src/app", "src/lib"]) {
      walk(path.join(process.cwd(), r));
    }
    expect(hits, `Found unstable_cache/revalidateTag in: ${hits.join(", ")}`).toEqual([]);
  });
});
