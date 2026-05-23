#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import {
  isSourceFileName,
  isTestLikeFile,
  issueReport,
  lineForOffset,
  nodeNameText,
  parseSource,
  readText,
  walkAst,
  walkFiles,
} from "./lib/static-check-utils.mjs";

const BOUNDED_HELPER_RE = /\b(?:executeBatch|runIsolatedBatch|mapWithConcurrency|pLimit|limitConcurrency)\s*\(/;

function isPromiseAllCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "all" &&
    nodeNameText(node.expression.expression) === "Promise"
  );
}

function mapTargetName(arg) {
  if (!ts.isCallExpression(arg) || !ts.isPropertyAccessExpression(arg.expression)) return null;
  if (arg.expression.name.text !== "map") return null;
  return nodeNameText(arg.expression.expression);
}

function collectStaticBoundedArrays(ast) {
  const bounded = new Set();
  walkAst(ast, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    if (ts.isArrayLiteralExpression(node.initializer)) {
      bounded.add(node.name.text);
      return;
    }
    if (
      ts.isCallExpression(node.initializer) &&
      ts.isPropertyAccessExpression(node.initializer.expression) &&
      node.initializer.expression.name.text === "filter" &&
      bounded.has(nodeNameText(node.initializer.expression.expression))
    ) {
      bounded.add(node.name.text);
    }
  });
  return bounded;
}

function hasExplicitLengthGuard(sourcePrefix, target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:${escaped}\\.length\\s*>\\s*MAX_|Math\\.min\\(\\s*${escaped}\\.length|${escaped}\\s*=\\s*[^\\n;]+\\.slice\\()`).test(
    sourcePrefix
  );
}

function isBoundedPromiseAllArg(arg, ast, source, staticBoundedArrays) {
  if (ts.isArrayLiteralExpression(arg)) return true;
  const text = arg.getText(ast);
  if (/\bArray\.from\s*\(\s*\{\s*length:\s*Math\.min\s*\(/.test(text)) return true;
  if (BOUNDED_HELPER_RE.test(source)) return true;

  const target = mapTargetName(arg);
  if (!target) return true;
  if (target.includes(".slice(")) return true;
  if (staticBoundedArrays.has(target)) return true;
  return hasExplicitLengthGuard(source.slice(0, arg.getStart(ast)), target);
}

export function analyzeConcurrencyCapGuards(root = process.cwd()) {
  const issues = [];
  const files = walkFiles(root, ["src"], {
    include(rel, name) {
      return isSourceFileName(name) && !isTestLikeFile(rel);
    },
  });

  for (const file of files) {
    const source = readText(root, file);
    const { ast } = parseSource(root, file);
    const staticBoundedArrays = collectStaticBoundedArrays(ast);

    walkAst(ast, (node) => {
      if (!isPromiseAllCall(node)) return;
      const arg = node.arguments[0];
      if (!arg || isBoundedPromiseAllArg(arg, ast, source, staticBoundedArrays)) return;
      issues.push({
        issue: "promise_all_map_without_concurrency_cap",
        file,
        line: lineForOffset(ast, node.getStart(ast)),
        expression: arg.getText(ast).slice(0, 120),
      });
    });
  }

  return issueReport("concurrency-cap-guards", issues, { filesChecked: files.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeConcurrencyCapGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
