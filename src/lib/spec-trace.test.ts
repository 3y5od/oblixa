import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_SPEC_TRACE } from "./compatibility-spec-trace-map";

describe("v9 spec trace matrix", () => {
  it("maps every tracked section id to existing artifacts", () => {
    const ids = Object.keys(V9_SPEC_TRACE);
    expect(ids.length).toBeGreaterThan(100);

    for (const id of ids) {
      const artifacts = V9_SPEC_TRACE[id as keyof typeof V9_SPEC_TRACE];
      expect(artifacts, `missing trace for §${id}`).toBeDefined();
      expect(artifacts!.length).toBeGreaterThan(0);
      for (const rel of artifacts!) {
        const abs = join(process.cwd(), rel);
        expect(existsSync(abs), rel).toBe(true);
      }
    }
  });
});
