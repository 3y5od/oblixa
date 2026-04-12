import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd(), "public", ".well-known", "security.txt");
const semgrepConfig = path.join(process.cwd(), "semgrep", "oblixa-security.yml");
const worksheetPath = path.join(
  process.cwd(),
  "docs",
  "SECURITY_SWEEP_QUARTERLY_WORKSHEET.md"
);

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

describe("SECURITY_SWEEP_QUARTERLY_WORKSHEET.md drift guard", () => {
  it("retains numbered sections, appendices, and command matrix", () => {
    if (!fs.existsSync(worksheetPath)) return;
    const raw = fs.readFileSync(worksheetPath, "utf8");
    /** ≥20 distinct anchors (plan §7) — section titles + structural headings */
    const worksheetAnchors = [
      "Quarterly security sweep worksheet",
      "## Tag legend",
      "## Command matrix",
      "npm run security:sweep:quarterly",
      "npm run security:sweep:full",
      "npm run report:security-docs",
      "npm run check:security-static",
      "npm run verify",
      "npm run sbom",
      "## Explicitly not in default repo automation",
      "## 1. Program and governance",
      "## 10. Browser security",
      "## 20. Cryptography hygiene",
      "## 32. Oblixa-specific",
      "## 40. Bug bounty",
      "## Appendix Z",
      "## Appendix AA",
      "## Related documentation and assets",
      "Cannot be closed in the repository",
      "| Control ID | Framework ref | Description | Owner | Evidence | Last verified |",
      "postMessage(",
    ];
    expect(worksheetAnchors.length).toBeGreaterThanOrEqual(20);
    for (const s of worksheetAnchors) {
      expect(raw).toMatch(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    for (let n = 1; n <= 40; n += 1) {
      expect(raw).toContain(`## ${n}.`);
    }
    const appendixZLines = raw.match(/^\s*(\d+)\.\s+\S/mg) ?? [];
    const appendixZNumbers = appendixZLines.map((line) =>
      Number.parseInt(/^\s*(\d+)\./.exec(line)?.[1] ?? "0", 10)
    );
    const maxZ = Math.max(0, ...appendixZNumbers);
    expect(maxZ).toBeGreaterThanOrEqual(50);
  });
});
