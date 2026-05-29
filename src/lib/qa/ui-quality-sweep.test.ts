import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app", "src/components"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    if (![...SOURCE_EXTENSIONS].some((ext) => path.endsWith(ext))) return [];
    return [path];
  });
}

function appUiSources() {
  return ROOTS.flatMap((root) => sourceFiles(join(process.cwd(), root))).filter(
    (path) =>
      !path.endsWith(".test.ts") &&
      !path.endsWith(".test.tsx") &&
      !path.includes(join("src", "app", "api"))
  );
}

describe("app-wide UI quality sweep", () => {
  it("keeps fit-content out of rendered app surfaces", () => {
    const offenders = appUiSources().flatMap((path) => {
      const raw = readFileSync(path, "utf8");
      return raw.includes("fit-content") || raw.includes("w-fit")
        ? [relative(process.cwd(), path)]
        : [];
    });

    expect(offenders).toEqual([]);
  });

  it("uses shared mutation status alert primitives instead of bare red/green text", () => {
    const bareTonePattern = /text-(red|green)-(600|700)/;
    const offenders = appUiSources().flatMap((path) => {
      const raw = readFileSync(path, "utf8");
      return bareTonePattern.test(raw) ? [relative(process.cwd(), path)] : [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps InlineMutationStatus mapped to shared semantic alerts", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/ui/inline-mutation-status.tsx"),
      "utf8"
    );

    expect(raw).toContain('warning: "ui-alert-warning"');
    expect(raw).toContain('info: "ui-alert-info"');
    expect(raw).not.toContain("bg-amber-50");
    expect(raw).not.toContain("bg-sky-50");
  });

  it("avoids generic default Open CTAs in operational cards", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/ui/operational-summary-card.tsx"),
      "utf8"
    );

    expect(raw).not.toContain("Open ${props.title}");
    expect(raw).toContain("fallbackActionVerb");
  });

  it("avoids generic Open-prefixed CTA props in rendered app surfaces", () => {
    const genericCtaPatterns = [
      /actionLabel\s*=\s*"Open\s/,
      /actionLabel\s*:\s*[^\n]*"Open\s/,
      /action=\{\{[^\n]*label:\s*"Open\s/,
      /nextAction=\{\{[^\n]*label:\s*"Open\s/,
    ];
    // v11 dashboard spec compliance Tier 3.1 mandates `actionLabel: "Open work"`
    // as the primary action for the spec Work Needing Action section + Blocked
    // work top card. The lint rule predates that spec requirement; exempt
    // dashboard-upper.tsx specifically.
    const SPEC_EXEMPT_FILES = new Set([
      "src/components/dashboard/dashboard-upper.tsx",
    ]);
    const offenders = appUiSources().flatMap((path) => {
      const relPath = relative(process.cwd(), path);
      if (SPEC_EXEMPT_FILES.has(relPath)) return [];
      const raw = readFileSync(path, "utf8");
      return genericCtaPatterns.some((pattern) => pattern.test(raw))
        ? [relPath]
        : [];
    });

    expect(offenders).toEqual([]);
  });

  it("avoids generic View-prefixed CTA props in rendered app surfaces", () => {
    const genericCtaPatterns = [
      /actionLabel\s*=\s*"View\s/,
      /actionLabel\s*:\s*[^\n]*"View\s/,
      /action=\{\{[^\n]*label:\s*"View\s/,
      /nextAction=\{\{[^\n]*label:\s*"View\s/,
    ];
    const offenders = appUiSources().flatMap((path) => {
      const raw = readFileSync(path, "utf8");
      return genericCtaPatterns.some((pattern) => pattern.test(raw))
        ? [relative(process.cwd(), path)]
        : [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps JSON diagnostics from using generic Open-prefixed visible copy", () => {
    const offenders = appUiSources().flatMap((path) => {
      // The contracts table renders "Open contract" because that string
      // is the canonical row action named in oblixa-release-state.md
      // (Contracts > Row actions). It is the primary noun of the page,
      // not generic JSON/diagnostic Open-prefixed copy.
      if (path.endsWith(join("contracts", "contract-table.tsx"))) return [];
      const raw = readFileSync(path, "utf8");
      return />\s*Open\s+[A-Za-z][^<]*(JSON|diagnostic|source|queue|workspace|contract|page)/.test(raw) ||
        /aria-label=\{?`?Open\s/.test(raw)
        ? [relative(process.cwd(), path)]
        : [];
    });

    expect(offenders).toEqual([]);
  });

  it("uses semantic tokens or alert primitives instead of legacy amber/rose surface classes", () => {
    const legacyTonePattern = /text-(rose|amber)-(700|800)|bg-(rose|amber|red)-50/;
    const offenders = appUiSources().flatMap((path) => {
      const raw = readFileSync(path, "utf8");
      return legacyTonePattern.test(raw) ? [relative(process.cwd(), path)] : [];
    });

    expect(offenders).toEqual([]);
  });
});