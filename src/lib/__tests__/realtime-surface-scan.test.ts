import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("realtime / SSE / WS surface (Phase 22)", () => {
  it("documents scan for supabase realtime channel usage", () => {
    const root = join(process.cwd(), "src");
    const hits: string[] = [];
    const scan = (label: string, text: string) => {
      if (/\bchannel\s*\(\s*['"]/.test(text) || /\.subscribe\s*\(/.test(text)) hits.push(label);
    };
    scan("instrumentation", readFileSync(join(root, "instrumentation.ts"), "utf8"));
    expect(hits.length, "extend with integration tests when realtime channels ship").toBe(0);
  });
});
