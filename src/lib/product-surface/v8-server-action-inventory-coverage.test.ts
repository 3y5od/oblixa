import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFeatureMappingForAction } from "@/lib/product-surface/v8-surface-mapping";

const ACTIONS_ROOT = path.resolve(process.cwd(), "src/actions");

function walkActionFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkActionFiles(full, out);
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function exportedAsyncActionNames(source: string): string[] {
  const out: string[] = [];
  const regex = /export\s+async\s+function\s+(\w+)/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(source)) !== null) {
    out.push(match[1]);
  }
  return out;
}

describe("v8 server action inventory coverage", () => {
  it("maps or exempts all exported server actions", () => {
    const actionFiles = walkActionFiles(ACTIONS_ROOT);
    const unmapped: string[] = [];

    for (const actionFile of actionFiles) {
      const source = readFileSync(actionFile, "utf8");
      if (!source.includes('"use server"')) continue;
      const exports = exportedAsyncActionNames(source);
      const rel = path.relative(process.cwd(), actionFile).split(path.sep).join("/");
      for (const actionName of exports) {
        const mapping = resolveFeatureMappingForAction(`${rel}:${actionName}`);
        if (mapping.status === "unmapped") {
          unmapped.push(`${rel}:${actionName}`);
        }
      }
    }

    expect(unmapped).toEqual([]);
  });
});
