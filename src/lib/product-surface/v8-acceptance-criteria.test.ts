import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function pkgScripts(): Record<string, string> {
  return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts as Record<
    string,
    string
  >;
}

/**
 * Maps V8 acceptance criteria to enforced scripts/tests (grepable in CI output).
 */
describe("V8 §24 acceptance criteria (machine checks)", () => {
  describe("§24.1 governed surfaces mapped or exempt", () => {
    it("runs page, API, and action inventory gates", () => {
      const s = pkgScripts();
      expect(s["check:v8-page-inventory"]).toBeDefined();
      expect(s["check:v8-api-inventory"]).toBeDefined();
      expect(s["check:v8-action-inventory"]).toBeDefined();
    });
  });

  describe("§24.2 uniform eligibility", () => {
    it("includes acceptance matrix and API/action eligibility in v8-suite", () => {
      const suite = pkgScripts()["check:v8-suite"] ?? "";
      expect(suite).toContain("check:v8-acceptance-matrix");
      expect(suite).toContain("check:v8-api-eligibility");
      expect(suite).toContain("check:v8-action-eligibility");
    });
  });

  describe("§24.3 Core isolation", () => {
    it("runs strict href audit in v8-suite", () => {
      expect(pkgScripts()["check:v8-suite"]).toContain("check:v8-hrefs:strict");
    });
  });

  describe("§24.4 hidden modules", () => {
    it("includes vocabulary + refinement contracts in v8-suite", () => {
      const suite = pkgScripts()["check:v8-suite"] ?? "";
      expect(suite).toContain("check:v8-vocabulary");
      expect(suite).toContain("refinement-contract.test.ts");
    });
  });

  describe("§24.5 API auth", () => {
    it("includes API route tests and workspace eligibility in v8-suite", () => {
      const suite = pkgScripts()["check:v8-suite"] ?? "";
      expect(suite).toContain("check:api-route-tests");
      expect(suite).toContain("check:v8-api-eligibility");
    });
  });

  describe("§24.6 service-role discipline", () => {
    it("includes server-lib-admin in v8-suite", () => {
      expect(pkgScripts()["check:v8-suite"]).toContain("check:server-lib-admin");
    });
  });

  describe("§24.7 diagnostics", () => {
    it("includes diagnostics contract in v8-suite", () => {
      expect(pkgScripts()["check:v8-suite"]).toContain("check:v8-diagnostics-contract");
    });
  });

  describe("§24.8 suite fails on drift", () => {
    it("lists route inventory, denial mapping, and supplemental contracts", () => {
      const suite = pkgScripts()["check:v8-suite"] ?? "";
      expect(suite).toContain("check:route-inventory");
      expect(suite).toContain("check:v8-denial-mapping");
      expect(suite).toContain("check:v8-supplemental-contracts");
    });
  });
});
