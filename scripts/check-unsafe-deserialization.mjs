#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import {
  issueReport,
  lineForOffset,
  nodeNameText,
  parseSource,
  stringLiteralValue,
  walkAst,
  walkFiles,
  isSourceFileName,
  isTestLikeFile,
} from "./lib/static-check-utils.mjs";

const SCAN_DIRS = ["src", "scripts"];
const UNSAFE_WHOLE_MODULES = new Set([
  "node:vm",
  "vm",
  "node-serialize",
  "serialize-javascript",
]);
const V8_MODULES = new Set(["node:v8", "v8"]);
const UNSAFE_CALL_NAMES = new Set(["deserialize", "unserialize"]);
const VM_EVAL_METHODS = new Set(["runInContext", "runInNewContext", "runInThisContext", "compileFunction"]);

function isRequireCall(node) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require";
}

function isDynamicImportCall(node) {
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function callName(node) {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  if (ts.isElementAccessExpression(node.expression)) return stringLiteralValue(node.expression.argumentExpression);
  return "";
}

function moduleNameFromRequireOrImportCall(node) {
  if (!(isRequireCall(node) || isDynamicImportCall(node))) return null;
  return stringLiteralValue(node.arguments[0]);
}

export function analyzeUnsafeDeserialization(root = process.cwd()) {
  const issues = [];
  const files = walkFiles(root, SCAN_DIRS, {
    include: (rel, name) => isSourceFileName(name) && !isTestLikeFile(rel),
  });

  for (const file of files) {
    const { ast } = parseSource(root, file);
    walkAst(ast, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleName = stringLiteralValue(node.moduleSpecifier);
        if (moduleName && UNSAFE_WHOLE_MODULES.has(moduleName)) {
          issues.push({
            issue: "unsafe_deserialization_or_vm_import",
            file,
            module: moduleName,
            line: lineForOffset(ast, node.getStart(ast)),
          });
          return;
        }
        if (moduleName && V8_MODULES.has(moduleName)) {
          const clause = node.importClause;
          const namedBindings = clause?.namedBindings;
          if (namedBindings && ts.isNamedImports(namedBindings)) {
            for (const element of namedBindings.elements) {
              if (element.name.text === "deserialize") {
                issues.push({
                  issue: "unsafe_v8_deserialize_import",
                  file,
                  module: moduleName,
                  line: lineForOffset(ast, element.getStart(ast)),
                });
              }
            }
          }
        }
        return;
      }

      if (ts.isCallExpression(node)) {
        const moduleName = moduleNameFromRequireOrImportCall(node);
        if (moduleName && UNSAFE_WHOLE_MODULES.has(moduleName)) {
          issues.push({
            issue: "unsafe_deserialization_or_vm_require",
            file,
            module: moduleName,
            line: lineForOffset(ast, node.getStart(ast)),
          });
          return;
        }

        const name = callName(node);
        if (UNSAFE_CALL_NAMES.has(name)) {
          issues.push({
            issue: "unsafe_deserialization_call",
            file,
            call: name,
            line: lineForOffset(ast, node.getStart(ast)),
          });
          return;
        }

        if (ts.isPropertyAccessExpression(node.expression) && VM_EVAL_METHODS.has(node.expression.name.text)) {
          issues.push({
            issue: "unsafe_vm_execution_call",
            file,
            call: nodeNameText(node.expression.name),
            line: lineForOffset(ast, node.getStart(ast)),
          });
        }
      }
    });
  }

  return issueReport("unsafe-deserialization", issues, { filesChecked: files.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeUnsafeDeserialization();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
