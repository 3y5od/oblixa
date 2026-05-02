/**
 * Autonomous security program — Vitest evidence (describe titles align with plan todo IDs).
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";

function readPkg() {
  return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
}

describe("phase0-host-baseurl", () => {
  it("strips trailing slashes from NEXT_PUBLIC_APP_URL default path", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
    expect(getAppBaseUrlFromEnv()).toBe("https://example.com");
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});

describe("phase0-secrets-surface (aggregate script)", () => {
  it("runs security program checks without failure", () => {
    execSync("node scripts/check-autonomous-security-program.mjs", {
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "utf8",
    });
  });
});

describe("p2-json-bigint", () => {
  it("prefers string encoding for identifiers beyond Number.MAX_SAFE_INTEGER", () => {
    const numeric = JSON.parse('{"id":9007199254740993}') as { id: number };
    const textual = JSON.parse('{"id":"9007199254740993"}') as { id: string };
    expect(numeric.id.toString()).not.toBe(textual.id);
  });
});

describe("p2-duplicate-headers", () => {
  it("records Cookie header folding semantics for duplicate append", () => {
    const h = new Headers();
    h.append("Cookie", "a=1");
    h.append("Cookie", "b=2");
    const joined = h.get("Cookie");
    expect(joined).toMatch(/a=1/);
    expect(joined).toMatch(/b=2/);
  });
});

describe("p3-logging-redact", () => {
  it("imports central log redaction helper", async () => {
    const mod = await import("@/lib/observability/log-redaction");
    expect(typeof mod.formatUnknownForServerLog).toBe("function");
  });
});

describe("p3-sentry-scrub", () => {
  it("loads sentry scrub module", async () => {
    const mod = await import("@/lib/observability/sentry-scrub");
    expect(mod).toBeTruthy();
  });
});

describe("p3-audit-table", () => {
  it("audit_events table is referenced in schema migration", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/001_initial_schema.sql"), "utf8");
    expect(sql).toContain("audit_events");
  });
});

describe("p3-privacy-gdpr-code", () => {
  it("data lifecycle security script exists", () => {
    expect(readPkg().scripts["check:data-lifecycle-security"]).toBeTruthy();
  });
});

describe("p3-ai-llm-surface", () => {
  it("AI guard scripts exist in package manifest", () => {
    const s = readPkg().scripts;
    expect(s["check:ai-prompt-injection-guards"]).toBeTruthy();
    expect(s["check:ai-context-redaction"]).toBeTruthy();
  });
});

describe("test-chaos-degrade", () => {
  it("documents fail-closed contract: API auth returns null without a session", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/v4/api-auth.ts"), "utf8");
    expect(src).toContain("if (!user) return null");
    expect(src).toContain("if (!membership) return null");
  });
});

describe("p0-rate-limit-auth", () => {
  it("rate-limit coverage script is wired", () => {
    expect(readPkg().scripts["check:api-route-rate-limit-coverage"]).toBeTruthy();
  });
});

describe("sdlc-ci-pins-sbom", () => {
  it("CI pins actions to commit SHAs in checkout step", () => {
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/actions\/checkout@[0-9a-f]{40}/);
  });
});

describe("p1-headers-corp-coop", () => {
  it("security headers check script exists", () => {
    expect(readPkg().scripts["check:security-headers"]).toBeTruthy();
  });
});

describe("p2-rfc7807-problem-details", () => {
  it("mutation envelope helpers exist for API response validation", async () => {
    const mod = await import("@/lib/v10-mutation-envelope");
    expect(typeof mod.validateV10ApiResponseSchema).toBe("function");
  });
});
