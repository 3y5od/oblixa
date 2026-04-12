import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Node version alignment", () => {
  it(".nvmrc major satisfies package.json engines.node", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const engines = pkg.engines?.node as string | undefined;
    expect(engines).toBeDefined();
    const nvm = fs.readFileSync(path.join(process.cwd(), ".nvmrc"), "utf8").trim();
    expect(nvm).toMatch(/^\d+/);
    const major = Number.parseInt(nvm.split(".")[0] ?? "0", 10);
    expect(Number.isFinite(major)).toBe(true);
    const m = /^>=\s*(\d+)/.exec(engines ?? "");
    expect(m, `Unexpected engines.node format: ${engines}`).toBeTruthy();
    const minEngine = Number.parseInt(m![1], 10);
    expect(major >= minEngine, `.nvmrc major ${major} should be >= engines minimum ${minEngine}`).toBe(
      true
    );
  });
});
