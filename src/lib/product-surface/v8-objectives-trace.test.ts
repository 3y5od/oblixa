import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V8 objectives and artifacts traceability (§6–§7, §28)", () => {
  it("keeps required V8 enforcement scripts wired in package.json", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    for (const scriptName of [
      "check:v8-page-inventory",
      "check:v8-api-inventory",
      "check:v8-action-inventory",
      "check:v8-hrefs:strict",
      "check:v8-vocabulary",
    ]) {
      expect(pkg.scripts[scriptName]).toBeTruthy();
    }
  });

  it("wires composite suite scripts to Objective 8 (release-verifiable enforcement)", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    const suite = pkg.scripts["check:v8-suite"] ?? "";
    for (const needle of [
      "check:v8-page-inventory",
      "check:v8-api-inventory",
      "check:v8-action-inventory",
      "check:v8-hrefs:strict",
      "check:v8-vocabulary",
    ]) {
      expect(suite).toContain(needle);
    }
    expect(pkg.scripts["check:v8-suite"]).toContain("refinement-contract.test.ts");
  });
});
