import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRealtimeAuthBoundaries } from "./check-realtime-auth-boundaries.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeRealtimeAuthBoundaries enforces the current zero-live-realtime posture", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-realtime-boundaries-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:realtime-auth-boundaries": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:realtime-auth-boundaries\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:realtime-auth-boundaries"\n');
  write(root, "src/instrumentation.ts", "export const instrumentationReady = true;\n");
  write(
    root,
    "src/lib/__tests__/realtime-surface-scan.test.ts",
    `describe("realtime / SSE / WS surface (Phase 22)", () => {\n  it("documents scan for supabase realtime channel usage", () => {\n    const root = join(process.cwd(), "src");\n    const hits: string[] = [];\n    const scan = (label: string, text: string) => {\n      if (/\\bchannel\\s*\\(\\s*['"]/.test(text) || /\\.subscribe\\s*\\(/.test(text)) hits.push(label);\n    };\n    scan("instrumentation", readFileSync(join(root, "instrumentation.ts"), "utf8"));\n    expect(hits.length, "extend with integration tests when realtime channels ship").toBe(0);\n  });\n});\n`
  );

  const report = analyzeRealtimeAuthBoundaries(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeRealtimeAuthBoundaries reports live realtime surface hits", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-realtime-hits-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:realtime-auth-boundaries": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:realtime-auth-boundaries\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:realtime-auth-boundaries"\n');
  write(root, "src/instrumentation.ts", "export const instrumentationReady = true;\n");
  write(root, "src/lib/__tests__/realtime-surface-scan.test.ts", 'describe("realtime / SSE / WS surface (Phase 22)", () => {\nit("documents scan for supabase realtime channel usage", () => {\nscan("instrumentation", readFileSync(join(root, "instrumentation.ts"), "utf8"));\nexpect(hits.length, "extend with integration tests when realtime channels ship").toBe(0);\n});\n});\n');
  write(root, "src/lib/realtime-live.ts", 'const channel = client.channel("presence");\n');

  const report = analyzeRealtimeAuthBoundaries(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "unexpected_realtime_surface"), true);
});