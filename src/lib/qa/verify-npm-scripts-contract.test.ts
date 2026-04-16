import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function loadPackageScripts(): Record<string, string> {
  const raw = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8");
  return JSON.parse(raw).scripts as Record<string, string>;
}

function scriptNamesFromChain(chain: string): string[] {
  return chain
    .split(" && ")
    .map((s) => s.trim())
    .map((s) => (s.startsWith("npm run ") ? s.slice("npm run ".length).trim() : s))
    .filter((s) => s.length > 0);
}

describe("package.json composite scripts reference defined npm scripts", () => {
  it("defines the UI QA contract scripts", () => {
    const scripts = loadPackageScripts();
    for (const name of [
      "test:logic",
      "test:logic:watch",
      "test:logic:coverage",
      "test:ui",
      "test:ui:watch",
      "test:ui:a11y",
      "test:ui:coverage",
      "check:ui-surface-consistency",
      "check:page-heading-contract",
      "check:shell-landmarks",
      "check:route-state-coverage",
    ] as const) {
      expect(scripts[name], `Missing script ${name}`).toBeDefined();
    }
  });

  it("verify chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts.verify ?? "");
    for (const name of names) {
      expect(scripts[name], `verify references missing script: ${name}`).toBeDefined();
    }
  });

  it("verify:security chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["verify:security"] ?? "");
    for (const name of names) {
      expect(scripts[name], `verify:security references missing script: ${name}`).toBeDefined();
    }
  });

  it("security:sweep:full chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["security:sweep:full"] ?? "");
    for (const name of names) {
      expect(scripts[name], `security:sweep:full references missing script: ${name}`).toBeDefined();
    }
  });

  it("security:sweep:quarterly chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["security:sweep:quarterly"] ?? "");
    for (const name of names) {
      expect(scripts[name], `security:sweep:quarterly references missing script: ${name}`).toBeDefined();
    }
  });

  it("perf:sweep:full chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["perf:sweep:full"] ?? "");
    for (const name of names) {
      expect(scripts[name], `perf:sweep:full references missing script: ${name}`).toBeDefined();
    }
  });

  it("perf:sweep:quarterly chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["perf:sweep:quarterly"] ?? "");
    for (const name of names) {
      expect(scripts[name], `perf:sweep:quarterly references missing script: ${name}`).toBeDefined();
    }
  });

  it("report:security-docs chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["report:security-docs"] ?? "");
    for (const name of names) {
      expect(scripts[name], `report:security-docs references missing script: ${name}`).toBeDefined();
    }
  });

  it("qa:sweep:local-ci top-level chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["qa:sweep:local-ci"] ?? "");
    for (const name of names) {
      expect(scripts[name], `qa:sweep:local-ci references missing script: ${name}`).toBeDefined();
    }
  });

  it("qa:sweep:extended top-level chain", () => {
    const scripts = loadPackageScripts();
    const names = scriptNamesFromChain(scripts["qa:sweep:extended"] ?? "");
    for (const name of names) {
      expect(scripts[name], `qa:sweep:extended references missing script: ${name}`).toBeDefined();
    }
  });
});
