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
  walkAst,
  walkFiles,
} from "./lib/static-check-utils.mjs";

const RANGE_PAGINATION_HELPER = "src/lib/supabase/range-pagination.ts";
const MAX_PAGE_SIZE = 1_000;
const MAX_DEFAULT_ROWS = 250_000;
const MAX_OFFSET_EXCLUSIVE = 1_000_000;

function numericLiteralValue(node) {
  if (!node) return null;
  if (ts.isNumericLiteral(node)) return Number(node.text.replace(/_/g, ""));
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const value = numericLiteralValue(node.operand);
    return value === null ? null : -value;
  }
  return null;
}

function objectPropertyValue(obj, propertyName) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = nodeNameText(prop.name);
    if (name === propertyName) return prop.initializer;
  }
  return null;
}

function assertNumberConstant(issues, source, file, name, maxAllowed) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d[\\d_]*)\\s*;`));
  if (!match) {
    issues.push({ issue: "missing_pagination_constant", file, constant: name });
    return;
  }
  const value = Number(match[1].replace(/_/g, ""));
  if (value < 1 || value > maxAllowed) {
    issues.push({ issue: "pagination_constant_out_of_policy", file, constant: name, value, maxAllowed });
  }
}

function collectSourceFiles(root) {
  return walkFiles(root, ["src"], {
    include(rel, name) {
      return isSourceFileName(name) && !isTestLikeFile(rel);
    },
  });
}

export function analyzePaginationGuardrails(root = process.cwd()) {
  const issues = [];

  if (!fileExists(root, RANGE_PAGINATION_HELPER)) {
    issues.push({ issue: "missing_range_pagination_helper", file: RANGE_PAGINATION_HELPER });
  } else {
    const helper = readText(root, RANGE_PAGINATION_HELPER);
    assertNumberConstant(issues, helper, RANGE_PAGINATION_HELPER, "DEFAULT_PAGE_SIZE", MAX_PAGE_SIZE);
    assertNumberConstant(issues, helper, RANGE_PAGINATION_HELPER, "DEFAULT_MAX_ROWS", MAX_DEFAULT_ROWS);
    assertNumberConstant(issues, helper, RANGE_PAGINATION_HELPER, "DEFAULT_MAX_OFFSET_EXCLUSIVE", MAX_OFFSET_EXCLUSIVE);
    for (const marker of ["maxRows", "maxOffsetExclusive", "stoppedByOffsetCap", "truncated"]) {
      if (!helper.includes(marker)) {
        issues.push({ issue: "range_pagination_helper_missing_marker", file: RANGE_PAGINATION_HELPER, marker });
      }
    }
  }

  const files = collectSourceFiles(root);
  for (const file of files) {
    if (file === RANGE_PAGINATION_HELPER) continue;
    const { ast } = parseSource(root, file);
    walkAst(ast, (node) => {
      if (!ts.isCallExpression(node)) return;
      const callee = nodeNameText(node.expression);
      if (callee === "collectSupabaseRangePages") {
        const options = node.arguments[1];
        if (!options || !ts.isObjectLiteralExpression(options)) {
          issues.push({
            issue: "collect_range_pages_missing_options",
            file,
            line: lineForOffset(ast, node.getStart(ast)),
          });
          return;
        }
        if (!objectPropertyValue(options, "maxRows")) {
          issues.push({
            issue: "collect_range_pages_missing_max_rows",
            file,
            line: lineForOffset(ast, node.getStart(ast)),
          });
        }
        const pageSize = numericLiteralValue(objectPropertyValue(options, "pageSize"));
        if (pageSize !== null && pageSize > MAX_PAGE_SIZE) {
          issues.push({
            issue: "collect_range_pages_page_size_out_of_policy",
            file,
            line: lineForOffset(ast, node.getStart(ast)),
            value: pageSize,
            maxAllowed: MAX_PAGE_SIZE,
          });
        }
      }

      if (callee === "forEachSupabaseRangePage") {
        const options = node.arguments[2];
        if (!options) return;
        if (!ts.isObjectLiteralExpression(options)) {
          issues.push({
            issue: "for_each_range_pages_dynamic_options",
            file,
            line: lineForOffset(ast, node.getStart(ast)),
          });
          return;
        }
        const pageSize = numericLiteralValue(objectPropertyValue(options, "pageSize"));
        if (pageSize !== null && pageSize > MAX_PAGE_SIZE) {
          issues.push({
            issue: "for_each_range_pages_page_size_out_of_policy",
            file,
            line: lineForOffset(ast, node.getStart(ast)),
            value: pageSize,
            maxAllowed: MAX_PAGE_SIZE,
          });
        }
      }
    });
  }

  return issueReport("pagination-guardrails", issues, { filesChecked: files.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePaginationGuardrails();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
