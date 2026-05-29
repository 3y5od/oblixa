import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const METADATA_SPECIAL = [
  "src/app/apple-icon.tsx",
  "src/app/icon.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/twitter-image.tsx",
];

describe("artifacts/qa-closure-manifest.json", () => {
  it("matches nineteenth-expansion App Router metadata + global error + depth-1 tests + favicon", () => {
    const p = path.join(process.cwd(), "artifacts", "qa-closure-manifest.json");
    expect(fs.existsSync(p), "run: npm run report:qa-closure-manifest").toBe(true);
    const m = JSON.parse(fs.readFileSync(p, "utf8")) as {
      schemaVersion: number;
      appRouterMetadataSpecialFiles: string[];
      appRouterGlobalErrorFiles: string[];
      appRouterRootDepth1TestFiles: string[];
      appRouterFaviconIcoFiles: string[];
      qaMaxP10Steps: string[];
      srcTestUtilsFiles: string[];
      scriptsCodemodMjsFiles: string[];
      srcLibInternalTestFiles: string[];
      scriptsPipelineMjsFiles: string[];
      autonomousCodeOnlyQaObjectives: Array<{ id: string; title: string; npmScripts: string[] }>;
    };
    expect(m.schemaVersion).toBe(1);
    expect([...m.appRouterMetadataSpecialFiles].sort()).toEqual([...METADATA_SPECIAL].sort());
    expect(m.appRouterGlobalErrorFiles).toEqual(["src/app/global-error.tsx"]);
    expect(new Set(m.appRouterRootDepth1TestFiles)).toEqual(
      new Set([
        "src/app/app-shell-exports.test.ts",
        "src/app/external-marketing-surface-guard.test.ts",
        "src/app/opengraph-image-exports.test.ts",
        "src/app/robots.test.ts",
      ])
    );
    expect(m.appRouterFaviconIcoFiles).toEqual(["src/app/favicon.ico"]);
    expect(m.qaMaxP10Steps.length).toBe(35);
    expect(m.qaMaxP10Steps[m.qaMaxP10Steps.length - 1]).toBe("qa:sweep:checks:batch");
    expect(m.srcTestUtilsFiles.length).toBe(10);
    expect(m.scriptsCodemodMjsFiles.length).toBe(2);
    expect(m.srcLibInternalTestFiles.length).toBe(26);
    expect(m.scriptsPipelineMjsFiles.length).toBe(12);
    expect(m.autonomousCodeOnlyQaObjectives).toHaveLength(96);
    expect(m.autonomousCodeOnlyQaObjectives[0]).toMatchObject({
      id: "qa-001-baseline-execution",
      npmScripts: expect.arrayContaining(["check:quick", "lint", "test:scripts", "typecheck"]),
    });
    expect(m.autonomousCodeOnlyQaObjectives.at(-1)).toMatchObject({
      id: "qa-096-documentation-independence",
      npmScripts: expect.arrayContaining(["check:documentation-runtime-dependencies"]),
    });
  });
});
