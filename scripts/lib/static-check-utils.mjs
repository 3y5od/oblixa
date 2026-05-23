import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export function toPosix(value) {
  return value.replace(/\\/g, "/");
}

export function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

export function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

export function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function isSourceFileName(name) {
  return SOURCE_EXTENSIONS.has(path.extname(name));
}

export function isTestLikeFile(rel) {
  return (
    /\.(?:test|spec|ui\.test)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(rel) ||
    rel.includes("/__tests__/") ||
    rel.startsWith("e2e/")
  );
}

export function walkFiles(root, dirs, options = {}) {
  const include = options.include ?? (() => true);
  const skipDirs = new Set(options.skipDirs ?? ["node_modules", ".next", ".git", "coverage", "playwright-report", "test-results"]);
  const out = [];

  function walk(absDir) {
    if (!fs.existsSync(absDir)) return;
    for (const name of fs.readdirSync(absDir)) {
      if (skipDirs.has(name)) continue;
      const abs = path.join(absDir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
        continue;
      }
      const rel = toPosix(path.relative(root, abs));
      if (include(rel, name, stat)) out.push(rel);
    }
  }

  for (const dir of dirs) walk(path.join(root, dir));
  return out.sort();
}

export function sourceFileKindForPath(rel) {
  if (rel.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (rel.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (rel.endsWith(".js") || rel.endsWith(".mjs") || rel.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function parseSource(root, rel) {
  const source = readText(root, rel);
  const ast = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, sourceFileKindForPath(rel));
  return { source, ast };
}

export function walkAst(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walkAst(child, visit));
}

export function stringLiteralValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

export function nodeNameText(node) {
  if (!node) return "";
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isPrivateIdentifier(node)) return node.text;
  return node.getText();
}

export function lineForOffset(ast, offset) {
  return ast.getLineAndCharacterOfPosition(offset).line + 1;
}

export function issueReport(checkId, issues, extra = {}) {
  return { checkId, ok: issues.length === 0, issueCount: issues.length, issues, ...extra };
}
