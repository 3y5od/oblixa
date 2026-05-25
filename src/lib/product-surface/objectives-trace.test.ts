import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V8 objectives and artifacts traceability (§6–§7, §28)", () => {
  it("keeps required V8 enforcement scripts wired in package.json", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    for (const scriptName of [
      "check:surface:page-inventory",
      "check:surface:api-inventory",
      "check:surface:action-inventory",
      "check:surface:hrefs:strict",
      "check:surface:vocabulary",
    ]) {
      expect(pkg.scripts[scriptName]).toBeTruthy();
    }
  });

  it("wires composite suite scripts to Objective 8 (release-verifiable enforcement)", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    const suite = pkg.scripts["check:surface:suite"] ?? "";
    for (const needle of [
      "check:surface:page-inventory",
      "check:surface:api-inventory",
      "check:surface:action-inventory",
      "check:surface:hrefs:strict",
      "check:surface:vocabulary",
    ]) {
      expect(suite).toContain(needle);
    }
    expect(pkg.scripts["check:surface:suite"]).toContain("refinement-contract.test.ts");
  });
});
