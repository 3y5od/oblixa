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
  stringLiteralValue,
  walkAst,
  walkFiles,
} from "./lib/static-check-utils.mjs";

const SCAN_DIRS = ["src", "scripts", "e2e"];
const GROUP_WITH_INNER_AND_OUTER_QUANTIFIER_RE =
  /\((?:\?:|\?=|\?!|\?<=|\?<!)?\s*(?:\.|\\[wdsWDS]|\[[^\]]+\]|[A-Za-z0-9])(?:[+*]|\{\d+,\})\s*\)(?:[+*]|\{\d+,\})/u;
const WILDCARD_GROUP_RE = /\((?:\?:)?(?:\\.|[^()[\]\\]|\[[^\]]*\])*(?:\.\*|\.\+)(?:\\.|[^()[\]\\]|\[[^\]]*\])*\)(?:[+*]|\{\d+(?:,\d*)?\})/u;

function regexLiteralPattern(literal) {
  if (!literal.startsWith("/")) return null;
  let inClass = false;
  let escaped = false;
  for (let index = 1; index < literal.length; index += 1) {
    const ch = literal[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "[") inClass = true;
    else if (ch === "]") inClass = false;
    else if (ch === "/" && !inClass) {
      return literal.slice(1, index);
    }
  }
  return null;
}

function isRegularExpressionLiteral(node) {
  return node.kind === ts.SyntaxKind.RegularExpressionLiteral;
}

function classifyRegexPattern(pattern) {
  const issues = [];
  if (GROUP_WITH_INNER_AND_OUTER_QUANTIFIER_RE.test(pattern)) {
    issues.push("nested_quantifier_group");
  }
  if (WILDCARD_GROUP_RE.test(pattern)) {
    issues.push("repeated_wildcard_group");
  }
  return issues;
}

function regExpStaticPattern(node, ast) {
  if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return null;
  if (nodeNameText(node.expression) !== "RegExp") return null;
  const firstArg = node.arguments?.[0];
  if (!firstArg) return null;
  return stringLiteralValue(firstArg);
}

export function analyzeRegexDosRisk(root = process.cwd()) {
  const issues = [];
  const files = walkFiles(root, SCAN_DIRS, {
    include(rel, name) {
      return isSourceFileName(name) && !isTestLikeFile(rel);
    },
  });
  let regexCount = 0;

  for (const file of files) {
    const { ast } = parseSource(root, file);
    walkAst(ast, (node) => {
      let pattern = null;
      let sourceKind = null;
      if (isRegularExpressionLiteral(node)) {
        pattern = regexLiteralPattern(node.getText(ast));
        sourceKind = "literal";
      } else {
        pattern = regExpStaticPattern(node, ast);
        sourceKind = pattern === null ? null : "constructor";
      }
      if (pattern === null) return;
      regexCount += 1;
      const classifications = classifyRegexPattern(pattern);
      for (const classification of classifications) {
        issues.push({
          issue: classification,
          file,
          line: lineForOffset(ast, node.getStart(ast)),
          sourceKind,
          pattern,
        });
      }
    });
  }

  return issueReport("regex-dos-risk", issues, {
    filesChecked: files.length,
    regexCount,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRegexDosRisk();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
