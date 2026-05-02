#!/usr/bin/env node
/**
 * Verifies CI + satellite workflows include core supply-chain scanners (plan: supply-chain-security-jobs).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const requiredCi = ["semgrep", "osv-scanner", "gitleaks"];
const missing = requiredCi.filter((k) => !ci.includes(k));
const codeql = fs.existsSync(path.join(root, ".github", "workflows", "codeql.yml"));
const depReview = fs.existsSync(path.join(root, ".github", "workflows", "dependency-review.yml"));
const trivy = fs.existsSync(path.join(root, ".github", "workflows", "trivy-fs.yml"));
const ok = missing.length === 0 && codeql && depReview && trivy;
console.log(JSON.stringify({ checkId: "supply-chain-security-matrix", ok, missing, codeql, depReview, trivy }, null, 2));
process.exit(ok ? 0 : 1);
