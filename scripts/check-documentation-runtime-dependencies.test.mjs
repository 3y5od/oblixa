import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeDocumentationRuntimeDependencies } from "./check-documentation-runtime-dependencies.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-doc-runtime-deps-"));
}

function writeFile(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test("documentation runtime dependency check allows comments, labels, and test-only reads", () => {
  const root = makeRoot();
  writeFile(
    root,
    "src/lib/runtime.ts",
    `
      // v6.md section references are explanatory comments, not file dependencies.
      export const supportDocLabel = "support-runbook-draft.md";
    `,
  );
  writeFile(
    root,
    "src/lib/runtime.test.ts",
    `
      import { readFileSync } from "node:fs";
      readFileSync("docs/autonomous-security-code-checklist.md", "utf8");
    `,
  );

  const report = analyzeDocumentationRuntimeDependencies(root);
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test("documentation runtime dependency check rejects static imports from documentation", () => {
  const root = makeRoot();
  writeFile(root, "src/lib/runtime.ts", `import checklist from "../../docs/autonomous-security-code-checklist.md";\nexport { checklist };\n`);

  const report = analyzeDocumentationRuntimeDependencies(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "documentation_import_dependency");
  assert.equal(report.issues[0].reason, "autonomous_security_checklist");
});

test("documentation runtime dependency check rejects dynamic imports and requires", () => {
  const root = makeRoot();
  writeFile(
    root,
    "src/lib/runtime.ts",
    `
      require("../AGENTS.md");
      await import("../.cursor/rules/documentation.mdc");
    `,
  );

  const report = analyzeDocumentationRuntimeDependencies(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.length, 2);
  assert.deepEqual(
    report.issues.map((issue) => issue.issue).sort(),
    ["documentation_dynamic_import_dependency", "documentation_require_dependency"],
  );
});

test("documentation runtime dependency check rejects filesystem reads through path builders", () => {
  const root = makeRoot();
  writeFile(
    root,
    "src/lib/runtime.ts",
    `
      import { readFileSync } from "node:fs";
      import { join } from "node:path";

      const checklistPath = join(process.cwd(), "docs/autonomous-security-code-checklist.md");
      readFileSync(checklistPath, "utf8");
    `,
  );

  const report = analyzeDocumentationRuntimeDependencies(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "documentation_path_constructed_in_runtime");
  assert.equal(report.issues.some((issue) => issue.issue === "documentation_filesystem_dependency"), true);
});

test("documentation runtime dependency check rejects URL-based documentation path construction", () => {
  const root = makeRoot();
  writeFile(root, "src/lib/runtime.ts", `export const checklistUrl = new URL("../docs/autonomous-security-code-checklist.md", import.meta.url);\n`);

  const report = analyzeDocumentationRuntimeDependencies(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "documentation_path_constructed_in_runtime");
  assert.equal(report.issues[0].call, "new URL");
});
