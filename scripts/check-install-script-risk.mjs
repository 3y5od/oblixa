#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ALLOWLIST_PATH = path.join("artifacts", "supply-chain-install-script-allowlist.json");
const HIGH_RISK_NAME_RE = /(?:node-pre-gyp|prebuild-install|download|curl|wget|shell|exec|spawn|postinstall|install-script)/i;
const HIGH_RISK_BIN_RE = /(?:curl|wget|bash|sh|python|ruby|node-pre-gyp|prebuild|download)/i;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function packageNameFromLockPath(packagePath, meta) {
  if (typeof meta?.name === "string" && meta.name) return meta.name;
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  const tail = index >= 0 ? packagePath.slice(index + marker.length) : packagePath;
  const parts = tail.split("/");
  return parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAllowlist(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    byKey.set(`${entry.path}@${entry.version}`, entry);
  }
  return byKey;
}

function isHighRiskPackage(name, meta) {
  if (HIGH_RISK_NAME_RE.test(name)) return true;
  if (meta.hasInstallScript) return true;
  if (meta.bin) {
    for (const value of Object.values(meta.bin)) {
      if (HIGH_RISK_BIN_RE.test(String(value))) return true;
    }
  }
  return false;
}

export function analyzeInstallScriptRisk(root = process.cwd()) {
  const lockPath = path.join(root, "package-lock.json");
  const allowPath = path.join(root, ALLOWLIST_PATH);
  const issues = [];

  if (!fs.existsSync(lockPath)) issues.push({ issue: "missing_package_lock" });
  if (!fs.existsSync(allowPath)) issues.push({ issue: "missing_install_script_allowlist", path: ALLOWLIST_PATH });
  if (issues.length) return { checkId: "install-script-risk", ok: false, issueCount: issues.length, issues };

  const lockfile = readJson(lockPath);
  const allowlist = readJson(allowPath);
  const entries = Array.isArray(allowlist.entries) ? allowlist.entries : [];
  const allowed = normalizeAllowlist(entries);
  const today = todayIso();
  let installScriptPackageCount = 0;
  let highRiskPackageCount = 0;

  if (allowlist.version !== 1) issues.push({ issue: "invalid_install_script_allowlist_version", version: allowlist.version });
  for (const entry of entries) {
    for (const field of ["path", "name", "version", "owner", "reason", "expiresOn"]) {
      if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
        issues.push({ issue: "invalid_install_script_allowlist_entry", field, entry });
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.expiresOn ?? ""))) {
      issues.push({ issue: "invalid_install_script_allowlist_expiry", path: entry.path });
    } else if (entry.expiresOn < today) {
      issues.push({ issue: "expired_install_script_allowlist_entry", path: entry.path, expiresOn: entry.expiresOn });
    }
  }

  for (const [packagePath, meta] of Object.entries(lockfile.packages ?? {})) {
    if (packagePath === "") continue;
    const name = packageNameFromLockPath(packagePath, meta);
    if (!name || !meta?.version) continue;
    const highRisk = isHighRiskPackage(name, meta);
    if (highRisk) highRiskPackageCount += 1;
    if (!meta.hasInstallScript) continue;

    installScriptPackageCount += 1;
    const entry = allowed.get(`${packagePath}@${meta.version}`);
    if (!entry) {
      issues.push({ issue: "unreviewed_install_script_package", path: packagePath, name, version: meta.version });
      continue;
    }
    if (entry.name !== name) issues.push({ issue: "install_script_allowlist_name_mismatch", path: packagePath, allowlistName: entry.name, lockfileName: name });
    if (entry.reason.trim().length < 16) issues.push({ issue: "install_script_allowlist_reason_too_short", path: packagePath });
  }

  const lockPackageKeys = new Set(Object.keys(lockfile.packages ?? {}));
  for (const entry of entries) {
    if (!lockPackageKeys.has(entry.path)) {
      issues.push({ issue: "stale_install_script_allowlist_entry", path: entry.path });
    }
  }

  return {
    checkId: "install-script-risk",
    ok: issues.length === 0,
    installScriptPackageCount,
    highRiskPackageCount,
    allowlistEntryCount: entries.length,
    issueCount: issues.length,
    issues: issues.slice(0, 80),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeInstallScriptRisk();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
