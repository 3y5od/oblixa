#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import {
  fileExists,
  isSourceFileName,
  isTestLikeFile,
  issueReport,
  lineForOffset,
  nodeNameText,
  parseSource,
  readText,
  stringLiteralValue,
  walkAst,
  walkFiles,
} from "./lib/static-check-utils.mjs";

const REDIRECT_HELPER = "src/lib/security/redirect.ts";
const FALLBACK_DESTINATION_NAME_RE =
  /(?:^|_)(fallback_(?:href|url|path|destination)|fallback(?:Href|URL|Url|Path|Destination)|(?:href|url|path|destination)Fallback)$/i;
const SENSITIVE_QUERY_RE = /(?:^|[?&])(token|signature|secret|password|private[_-]?url)=/i;

function isSafeInternalFallbackPath(value) {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("://") &&
    !/[\r\n\x00-\x1f\x7f\\]/.test(value) &&
    !SENSITIVE_QUERY_RE.test(value)
  );
}

function isFallbackDestinationName(name) {
  return FALLBACK_DESTINATION_NAME_RE.test(name);
}

function addFallbackIssue(issues, file, ast, node, name, value) {
  if (isSafeInternalFallbackPath(value)) return;
  issues.push({
    issue: "unsafe_fallback_destination_literal",
    file,
    line: lineForOffset(ast, node.getStart(ast)),
    name,
    value,
  });
}

export function analyzeSecurityFallbackPaths(root = process.cwd()) {
  const issues = [];

  if (!fileExists(root, REDIRECT_HELPER)) {
    issues.push({ issue: "missing_redirect_fallback_helper", file: REDIRECT_HELPER });
  } else {
    const helper = readText(root, REDIRECT_HELPER);
    for (const [issue, marker] of [
      ["redirect_helper_missing_double_slash_rejection", 'startsWith("//")'],
      ["redirect_helper_missing_scheme_rejection", 'includes("://")'],
      ["redirect_helper_missing_control_character_rejection", "[\\x00-\\x1f\\x7f\\\\]"],
    ]) {
      if (!helper.includes(marker)) issues.push({ issue, file: REDIRECT_HELPER });
    }
  }

  const files = walkFiles(root, ["src"], {
    include(rel, name) {
      return isSourceFileName(name) && !isTestLikeFile(rel);
    },
  });

  for (const file of files) {
    const { ast } = parseSource(root, file);
    walkAst(ast, (node) => {
      if (ts.isPropertyAssignment(node)) {
        const name = nodeNameText(node.name);
        if (!isFallbackDestinationName(name)) return;
        const value = stringLiteralValue(node.initializer);
        if (value !== null) addFallbackIssue(issues, file, ast, node.initializer, name, value);
        return;
      }

      if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
        const name = nodeNameText(node.name);
        if (!isFallbackDestinationName(name)) return;
        const value = node.initializer ? stringLiteralValue(node.initializer) : null;
        if (value !== null) addFallbackIssue(issues, file, ast, node.initializer, name, value);
        return;
      }

      if (ts.isJsxAttribute(node)) {
        const name = nodeNameText(node.name);
        if (!isFallbackDestinationName(name) || !node.initializer || !ts.isStringLiteral(node.initializer)) return;
        addFallbackIssue(issues, file, ast, node.initializer, name, node.initializer.text);
      }
    });
  }

  return issueReport("security-fallback-paths", issues, { filesChecked: files.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSecurityFallbackPaths();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
