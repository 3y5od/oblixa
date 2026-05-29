import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeComplexity,
  analyzeDependencyCycles,
  analyzeImportBoundaries,
  analyzeRuntimeBoundaries,
} from "./check-operational-static-architecture-code-health.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-static-architecture-"));
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("import boundaries reject server imports from client modules", () => {
  const root = makeRoot();
  write(root, "src/components/client-widget.tsx", '"use client";\nimport fs from "node:fs";\nexport function Widget() { return null; }\n');
  const issues = [];
  const report = analyzeImportBoundaries(
    root,
    {
      importBoundaryRules: [
        {
          id: "client-no-node",
          appliesTo: { clientDirective: true, productionOnly: true },
          forbiddenSpecifiers: ["node:"],
          reason: "client code cannot import Node APIs",
        },
      ],
    },
    issues
  );

  assert.equal(report.violationCount, 1);
  assert.equal(issues[0].issue, "operational_static_import_boundary_violation");
});

test("runtime boundaries reject Node-only imports in edge route handlers", () => {
  const root = makeRoot();
  write(root, "src/app/api/edge/route.ts", 'export const runtime = "edge";\nimport { readFileSync } from "node:fs";\nexport function GET() {}\n');
  write(root, "next.config.ts", "const nextConfig = { serverExternalPackages: [] };\nexport default nextConfig;\n");
  const issues = [];
  const report = analyzeRuntimeBoundaries(
    root,
    {
      runtimeBoundary: {
        routeRoots: ["src/app"],
        edgeForbiddenSpecifiers: ["node:"],
        nodeNativeSpecifiers: ["node:"],
        requiredServerExternalPackages: [],
      },
    },
    issues
  );

  assert.equal(report.edgeRouteCount, 1);
  assert.equal(issues[0].issue, "operational_static_edge_forbidden_import");
});

test("complexity ratchets allow known baseline offenders but fail regressions", () => {
  const root = makeRoot();
  write(root, "scripts/known.mjs", `${"x\n".repeat(10)}`);
  write(root, "scripts/regression.mjs", `${"x\n".repeat(12)}`);
  writeJson(root, "scripts/script-complexity-baseline.json", {
    offenders: [{ file: "scripts/known.mjs", lines: 11 }],
  });
  const issues = [];
  const report = analyzeComplexity(
    root,
    {
      complexityRatchets: [
        {
          id: "script-complexity",
          roots: ["scripts"],
          extensions: [".mjs"],
          maxLines: 5,
          baseline: "scripts/script-complexity-baseline.json",
        },
      ],
    },
    issues
  );

  assert.equal(report[0].offenderCount, 2);
  assert.equal(report[0].regressionCount, 1);
  assert.equal(report[0].regressions[0].file, "scripts/regression.mjs");
});

test("dependency cycle ratchets allow known cycles but fail new cycles", () => {
  const root = makeRoot();
  write(root, "src/a.ts", 'import { b } from "./b";\nexport const a = b;\n');
  write(root, "src/b.ts", 'import { a } from "./a";\nexport const b = a;\n');
  write(root, "src/c.ts", 'import { d } from "./d";\nexport const c = d;\n');
  write(root, "src/d.ts", 'import { c } from "./c";\nexport const d = c;\n');
  writeJson(root, "scripts/dependency-cycles-baseline.json", {
    cycles: ["a.ts -> b.ts -> a.ts"],
  });
  const issues = [];
  const report = analyzeDependencyCycles(root, { dependencyCycleBaseline: "scripts/dependency-cycles-baseline.json" }, issues);

  assert.equal(report.cycleCount, 2);
  assert.equal(report.regressionCount, 1);
  assert.equal(report.regressions[0], "c.ts -> d.ts -> c.ts");
  assert.equal(issues[0].issue, "operational_static_dependency_cycle_regression");
});
