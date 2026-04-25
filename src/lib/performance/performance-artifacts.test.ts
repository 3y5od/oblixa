import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const worksheetPath = path.join(
  process.cwd(),
  "docs",
  "PERFORMANCE_OPTIMIZATION_SWEEP.md"
);
const semgrepPerf = path.join(process.cwd(), "semgrep", "oblixa-performance.yml");

describe("PERFORMANCE_OPTIMIZATION_SWEEP.md drift guard", () => {
  it("retains structure, 60 sections, appendices, and Appendix Z depth", () => {
    if (!fs.existsSync(worksheetPath)) return;
    const raw = fs.readFileSync(worksheetPath, "utf8");
    expect(raw).toContain("Performance optimization sweep");
    expect(raw).toContain("## Command matrix");
    expect(raw).toContain("## Tag legend");
    expect(raw).toContain("## Coverage map");
    expect(raw).toContain("## Appendix Z");
    expect(raw).toMatch(/cannot be closed in the repository/i);
    expect(raw).toContain("## Appendix A");
    expect(raw).toContain("## Appendix B");
    expect(raw).toContain("## Appendix C");
    expect(raw).toContain("## Appendix D");
    expect(raw).toContain("## Appendix E");
    expect(raw).toContain("| Metric | Route or scope | Target | Owner | Evidence | Last verified |");
    expect(raw).toContain("| Cost driver | Measurement source | Owner | Review cadence | Last note |");
    expect(raw).toContain("| Scenario | Degraded behavior | Owner | Last drill | Link to runbook |");
    expect(raw).toContain("| Scenario | Tool | Env | Max RPS | Pass criteria | Last run |");
    expect(raw).toContain("| Control | Evidence type | Location | Owner | Last updated |");

    const worksheetAnchors = [
      "npm run perf:sweep:quarterly",
      "npm run perf:sweep:full",
      "npm run check:performance-static",
      "npm run check:performance-static:grep",
      "npm run analyze",
      "npm run verify",
      "`test:e2e`",
      "npm run audit:ui-operational",
      "npm run check:security-static:grep",
      "Semgrep (CI)",
      "oblixa-performance.yml",
      "## Explicitly not in default repo automation",
      "## 1. Outcomes, SLOs, and economic framing",
      "## 5. Fonts, images, media, and CLS",
      "## 10. Server Components vs client islands",
      "## 12. next/dynamic, code splitting, and heavy client modules",
      "## 15. API design: pagination, field selection, batching",
      "## 25. Migrations, bloat, vacuum, and stats",
      "## 33. Search (if present): index cost and relevance",
      "## 34. Real-time/presence (if present): fanout",
      "## 20. Indexes, plans, and sequential scan review",
      "## 26. Caching layers (HTTP, data cache, KV if used)",
      "## 30. Email, Slack, and outbound integration throughput",
      "## 35. Stripe/billing API usage",
      "## 40. Mobile, low-end devices, and responsive density",
      "## 45. Data retention, archival, and analytics ETL",
      "## 49. Third-party scripts and embeds",
      "## 50. Annual deep review and vendor engagement",
      "## 51. GameDay, chaos, and degraded-mode drills",
      "## 55. Sales demo, training, and sandbox environment skew",
      "## 60. Post-incident and post-release performance retrospective",
      "scripts/performance-static-audit.mjs",
      "performance-artifacts.test.ts",
      "SECURITY_SWEEP_QUARTERLY_WORKSHEET.md",
      "SECURITY_PASS_CHECKLIST.md",
      "instrumentation-client.ts",
      "dashboard-data.ts",
      "next.config.ts",
      "playwright.config.ts",
    ];
    expect(worksheetAnchors.length).toBeGreaterThanOrEqual(35);
    for (const s of worksheetAnchors) {
      expect(raw).toContain(s);
    }

    for (let n = 1; n <= 60; n += 1) {
      expect(raw).toContain(`## ${n}.`);
    }

    const appendixZLines = raw.match(/^\s*(\d+)\.\s+\S/mg) ?? [];
    const appendixZNumbers = appendixZLines.map((line) =>
      Number.parseInt(/^\s*(\d+)\./.exec(line)?.[1] ?? "0", 10)
    );
    const maxZ = Math.max(0, ...appendixZNumbers);
    expect(maxZ).toBeGreaterThanOrEqual(80);
  });
});

describe("semgrep oblixa-performance.yml drift guard", () => {
  it("keeps performance rules pack non-empty", () => {
    const raw = fs.readFileSync(semgrepPerf, "utf8");
    expect(raw).toContain("rules:");
    expect(raw).toContain("oblixa-perf-supabase-select-star");
    expect(raw).toContain("oblixa-perf-supabase-large-limit");
  });
});

const qaLoadingChecklistPath = path.join(
  process.cwd(),
  "scripts",
  "qa-loading-routes-checklist.txt"
);
const releasePreflightPath = path.join(process.cwd(), "scripts", "release-preflight.mjs");

describe("performance checklist and release gate anchors", () => {
  it("keeps qa-loading-routes-checklist and release-preflight wired for perf gates", () => {
    expect(fs.existsSync(qaLoadingChecklistPath)).toBe(true);
    const checklist = fs.readFileSync(qaLoadingChecklistPath, "utf8");
    expect(checklist).toContain("src/app/(dashboard)/loading.tsx");
    expect(checklist).toContain("src/app/(dashboard)/decisions/loading.tsx");
    expect(checklist).toContain("src/app/(dashboard)/assurance/loading.tsx");
    expect(checklist).toContain("src/app/(auth)/loading.tsx");
    expect(checklist).toContain("src/app/(dashboard)/reports/loading.tsx");

    expect(fs.existsSync(releasePreflightPath)).toBe(true);
    const preflight = fs.readFileSync(releasePreflightPath, "utf8");
    expect(preflight).toContain("check:performance-static:strict");
  });
});
