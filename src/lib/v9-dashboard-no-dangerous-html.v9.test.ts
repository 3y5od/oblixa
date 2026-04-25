import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SKIP_DIR = new Set(["node_modules", ".next", "__tests__"]);

function walkTsFiles(dir: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walkTsFiles(p, out);
    } else if (ent.isFile() && (ent.name.endsWith(".tsx") || ent.name.endsWith(".ts"))) {
      out.push(p);
    }
  }
}

describe("Core dashboard tree avoids dangerouslySetInnerHTML (V9 §5.3 / §22)", () => {
  it("scans dashboard + primary Core component folders for raw HTML injection", () => {
    const roots = [
      join(process.cwd(), "src/app/(dashboard)"),
      join(process.cwd(), "src/components/dashboard"),
      join(process.cwd(), "src/components/contracts"),
      join(process.cwd(), "src/components/work"),
    ];
    const files: string[] = [];
    for (const r of roots) {
      try {
        statSync(r);
      } catch {
        continue;
      }
      walkTsFiles(r, files);
    }
    expect(files.length).toBeGreaterThan(20);
    const hits: string[] = [];
    for (const f of files) {
      const raw = readFileSync(f, "utf8");
      if (raw.includes("dangerouslySetInnerHTML")) hits.push(f);
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
