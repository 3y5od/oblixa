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
  stringLiteralValue,
  toPosix,
  walkAst,
  walkFiles,
} from "./lib/static-check-utils.mjs";

const CHECK_ID = "documentation-runtime-dependencies";

const DEFAULT_RUNTIME_ROOTS = ["src", "app", "pages", "supabase/functions"];

const DEFAULT_RUNTIME_CONFIG_FILES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "sentry.client.config.js",
  "sentry.client.config.ts",
  "sentry.edge.config.js",
  "sentry.edge.config.ts",
  "sentry.server.config.js",
  "sentry.server.config.ts",
  "middleware.js",
  "middleware.ts",
  "proxy.js",
  "proxy.ts",
];

const FILESYSTEM_DEPENDENCY_CALLEES = new Set([
  "access",
  "accessSync",
  "createReadStream",
  "existsSync",
  "lstat",
  "lstatSync",
  "open",
  "openSync",
  "readFile",
  "readFileSync",
  "readdir",
  "readdirSync",
  "stat",
  "statSync",
]);

const PATH_BUILDER_CALLEES = new Set(["join", "normalize", "resolve"]);

function normalizeLiteralPath(value) {
  return toPosix(String(value).trim()).replace(/^file:\/\//, "");
}

function docPathReason(value) {
  const normalized = normalizeLiteralPath(value);
  const withoutLeadingDot = normalized.replace(/^\.\//, "");
  const withoutLeadingParents = withoutLeadingDot.replace(/^(\.\.\/)+/, "");

  if (withoutLeadingParents.includes("autonomous-security-code-checklist.md")) {
    return "autonomous_security_checklist";
  }
  if (/(^|\/)docs\//.test(withoutLeadingParents)) {
    return "docs_directory";
  }
  if (/(^|\/)\.cursor\/rules\//.test(withoutLeadingParents)) {
    return "cursor_rules_documentation";
  }
  if (/(^|\/)\.github\/pull_request_template\.md$/i.test(withoutLeadingParents)) {
    return "pull_request_template";
  }
  if (/(^|\/)(?:AGENTS|README|CHANGELOG|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)\.md$/i.test(withoutLeadingParents)) {
    return "root_documentation_file";
  }
  if (/\.(?:md|mdx|mdc)$/i.test(withoutLeadingParents)) {
    return "markdown_documentation_file";
  }
  return null;
}

function calleeName(callee, ast) {
  if (!callee) return "";
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return callee.getText(ast);
}

function calleeText(callee, ast) {
  return callee?.getText(ast) ?? "";
}

function isFilesystemDependencyCall(node, ast) {
  if (!ts.isCallExpression(node)) return false;
  const name = calleeName(node.expression, ast);
  return FILESYSTEM_DEPENDENCY_CALLEES.has(name) || FILESYSTEM_DEPENDENCY_CALLEES.has(calleeText(node.expression, ast));
}

function isPathBuilderCall(node, ast) {
  if (!ts.isCallExpression(node)) return false;
  const name = calleeName(node.expression, ast);
  return PATH_BUILDER_CALLEES.has(name) || PATH_BUILDER_CALLEES.has(calleeText(node.expression, ast));
}

function collectDocumentationLiterals(node) {
  if (!node) return [];
  const found = [];

  function visit(current) {
    const literal = stringLiteralValue(current);
    if (literal) {
      const reason = docPathReason(literal);
      if (reason) found.push({ value: literal, reason, pos: current.getStart() });
    }
    ts.forEachChild(current, visit);
  }

  visit(node);
  return found;
}

function literalValue(node) {
  return node ? stringLiteralValue(node) : null;
}

function reportIssue(issues, seen, ast, issue, file, literal, extra = {}) {
  const key = `${issue}:${file}:${literal.pos}:${literal.value}`;
  if (seen.has(key)) return;
  seen.add(key);
  issues.push({
    issue,
    file,
    line: lineForOffset(ast, literal.pos),
    path: literal.value,
    reason: literal.reason,
    ...extra,
  });
}

function isScannedRuntimeFile(rel) {
  return isSourceFileName(rel) && !isTestLikeFile(rel) && !rel.includes("/__fixtures__/") && !rel.includes("/test-utils/");
}

function runtimeFiles(root, options) {
  const roots = options.runtimeRoots ?? DEFAULT_RUNTIME_ROOTS;
  const files = walkFiles(root, roots, {
    include: (rel) => isScannedRuntimeFile(rel),
  });
  const extraFiles = options.runtimeConfigFiles ?? DEFAULT_RUNTIME_CONFIG_FILES;
  for (const rel of extraFiles) {
    if (fileExists(root, rel) && isSourceFileName(rel)) files.push(rel);
  }
  return [...new Set(files)].sort();
}

function analyzeFile(root, rel) {
  const { ast } = parseSource(root, rel);
  const issues = [];
  const seen = new Set();
  const documentationPathIdentifiers = new Map();

  walkAst(ast, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const literals = collectDocumentationLiterals(node.initializer);
    if (literals.length > 0) documentationPathIdentifiers.set(node.name.text, literals[0]);
  });

  walkAst(ast, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const literal = literalValue(node.moduleSpecifier);
      const reason = literal ? docPathReason(literal) : null;
      if (literal && reason) {
        reportIssue(issues, seen, ast, "documentation_import_dependency", rel, { value: literal, reason, pos: node.moduleSpecifier.getStart() });
      }
      return;
    }

    if (ts.isNewExpression(node) && calleeName(node.expression, ast) === "URL") {
      for (const literal of collectDocumentationLiterals(node)) {
        reportIssue(issues, seen, ast, "documentation_path_constructed_in_runtime", rel, literal, { call: "new URL" });
      }
      return;
    }

    if (!ts.isCallExpression(node)) return;

    const callText = calleeText(node.expression, ast);
    const callName = calleeName(node.expression, ast);
    const firstArg = node.arguments[0];
    const firstLiteral = literalValue(firstArg);
    const firstReason = firstLiteral ? docPathReason(firstLiteral) : null;

    if (callText === "require" && firstLiteral && firstReason) {
      reportIssue(issues, seen, ast, "documentation_require_dependency", rel, { value: firstLiteral, reason: firstReason, pos: firstArg.getStart() });
      return;
    }

    if (node.expression.kind === ts.SyntaxKind.ImportKeyword && firstLiteral && firstReason) {
      reportIssue(issues, seen, ast, "documentation_dynamic_import_dependency", rel, {
        value: firstLiteral,
        reason: firstReason,
        pos: firstArg.getStart(),
      });
      return;
    }

    if (isFilesystemDependencyCall(node, ast)) {
      const literals = [
        ...collectDocumentationLiterals(firstArg),
        ...(ts.isIdentifier(firstArg) && documentationPathIdentifiers.has(firstArg.text) ? [documentationPathIdentifiers.get(firstArg.text)] : []),
      ];
      for (const literal of literals) {
        reportIssue(issues, seen, ast, "documentation_filesystem_dependency", rel, literal, { call: callText || callName });
      }
      return;
    }

    if (isPathBuilderCall(node, ast)) {
      for (const literal of collectDocumentationLiterals(node)) {
        reportIssue(issues, seen, ast, "documentation_path_constructed_in_runtime", rel, literal, { call: callText || callName });
      }
    }
  });

  return issues;
}

export function analyzeDocumentationRuntimeDependencies(root = process.cwd(), options = {}) {
  const files = options.files ?? runtimeFiles(root, options);
  const issues = files.flatMap((rel) => analyzeFile(root, rel));
  return issueReport(CHECK_ID, issues, { scannedFiles: files.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeDocumentationRuntimeDependencies();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
