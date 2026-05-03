import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd(), "public", ".well-known", "security.txt");
const semgrepConfig = path.join(process.cwd(), "semgrep", "oblixa-security.yml");
describe("security.txt (RFC 9116)", () => {
  it("includes Contact, Expires, Policy, and Acknowledgments", () => {
    const raw = fs.readFileSync(root, "utf8");
    expect(raw).toMatch(/^\s*Contact:/m);
    expect(raw).toMatch(/^\s*Expires:/m);
    expect(raw).toMatch(/^\s*Policy:/m);
    expect(raw).toMatch(/^\s*Acknowledgments:/m);
  });
});

describe("semgrep oblixa-security.yml drift guard", () => {
  it("keeps custom rules pack non-empty", () => {
    const raw = fs.readFileSync(semgrepConfig, "utf8");
    expect(raw).toContain("rules:");
    expect(raw).toMatch(/-\s*id:\s*\S+/);
    expect(raw).toContain("oblixa-cleartext-http-string");
  });
});

