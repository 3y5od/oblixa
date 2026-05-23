import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeDynamicImportSpecifiers } from "./check-dynamic-import-specifiers.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeDynamicImportSpecifiers accepts string literal dynamic imports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dynamic-import-ok-"));
  write(root, "src/app/api/example/route.ts", 'export async function GET(){ return import("@/lib/example"); }\n');
  write(root, "scripts/example.mjs", 'await import("./check-example.mjs");\nawait import(`./static-example.mjs`);\n');

  const report = analyzeDynamicImportSpecifiers(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeDynamicImportSpecifiers rejects variable dynamic imports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dynamic-import-var-"));
  write(root, "src/app/api/example/route.ts", "export async function GET(){ return import(routeImportPath); }\n");

  const report = analyzeDynamicImportSpecifiers(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "non_literal_dynamic_import"), true);
});

test("analyzeDynamicImportSpecifiers rejects interpolated template dynamic imports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dynamic-import-template-"));
  write(root, "scripts/example.mjs", "const name = process.argv[2];\nawait import(`./${name}.mjs`);\n");

  const report = analyzeDynamicImportSpecifiers(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.specifier?.startsWith("`./${")), true);
});

test("analyzeDynamicImportSpecifiers rejects dynamic code execution sinks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dynamic-code-"));
  write(
    root,
    "src/components/bad.tsx",
    [
      "export function run(code: string) {",
      "  eval(code);",
      '  new Function("return code")();',
      '  setTimeout("alert(1)", 1);',
      '  document.createElement("script");',
      "}",
    ].join("\n")
  );

  const report = analyzeDynamicImportSpecifiers(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "eval_call"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "new_function_call"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "string_timer_code"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "script_element_injection"), true);
});

test("analyzeDynamicImportSpecifiers ignores forbidden words in strings and comments", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dynamic-code-strings-"));
  write(
    root,
    "src/components/ok.tsx",
    [
      "// eval(code)",
      'const text = "new Function(";',
      "export function Ok() { return text; }",
    ].join("\n")
  );

  const report = analyzeDynamicImportSpecifiers(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});
