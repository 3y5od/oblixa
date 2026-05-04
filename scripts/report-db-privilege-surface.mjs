#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { walkFiles } from "./lib/fs-walk.mjs";

const SOURCE_FILE_RE = /\.(ts|tsx)$/;
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx)$/;
const TEST_HELPER_FILE_RE = /(^|\/)\S*test-helper\.(ts|tsx)$/;
const REVIEWED_SAFE_EXCEPTIONS_PATH = path.join("scripts", "db-privilege-surface-safe-exceptions.txt");
const META_RE = /^#\s*meta:\s*owner=([^\s]+)\s+expiry=([0-9]{4}-[0-9]{2}-[0-9]{2})\s+reason=(.+)$/;

export function isRuntimeSourceFile(absPath) {
  return SOURCE_FILE_RE.test(absPath) && !TEST_FILE_RE.test(absPath) && !TEST_HELPER_FILE_RE.test(absPath);
}

export function hasRuntimeAdminSignal(text) {
  return text.split("\n").some((line) => {
    if (!line.includes("createAdminClient")) return false;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) return false;
    if (/^import\s+type\b/.test(trimmed)) return false;
    if (/^(export\s+)?type\b/.test(trimmed)) return false;
    if (/^import\s*{/.test(trimmed)) return false;
    if (/\bReturnType\s*<\s*typeof\s+createAdminClient\s*>/.test(trimmed)) return false;
    return true;
  });
}

export function hasOrgScopeSignal(text) {
  return /\borganization_id\b|\borganizationId\b|\borgIds?\b|\b[A-Za-z]+OrgId\b|\bgetOrgMemberRole\b|\brequireApiWorkspaceEligibility\b/.test(
    text
  );
}

export function loadReviewedSafeExceptions(root = process.cwd()) {
  const file = path.join(root, REVIEWED_SAFE_EXCEPTIONS_PATH);
  if (!fs.existsSync(file)) return new Map();
  const entries = new Map();
  let currentMeta = null;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      const match = trimmed.match(META_RE);
      if (match) {
        currentMeta = {
          owner: match[1],
          expiry: match[2],
          reason: match[3].trim(),
        };
      }
      continue;
    }
    if (!currentMeta) {
      throw new Error(`Reviewed safe exception entry requires preceding meta line: ${trimmed}`);
    }
    entries.set(trimmed.replace(/\\/g, "/"), currentMeta);
  }
  return entries;
}

export function analyzeDbPrivilegeSurface(root = process.cwd()) {
  const srcRoot = path.join(root, "src");
  const files = walkFiles(srcRoot, isRuntimeSourceFile);
  const reviewedSafeExceptions = loadReviewedSafeExceptions(root);
  const seenFiles = new Set();

  const rows = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    seenFiles.add(rel);
    const text = fs.readFileSync(abs, "utf8");
    const usesAdmin = hasRuntimeAdminSignal(text);
    const usesMembership = /\bgetDeterministicMembership\b|\bgetOrEnsureDeterministicMembership\b/.test(text);
    const usesOrgScope = hasOrgScopeSignal(text);
    if (!usesAdmin && !usesMembership) continue;
    const reviewed = reviewedSafeExceptions.get(rel) ?? null;
    rows.push({
      file: rel,
      usesAdmin,
      usesMembership,
      usesOrgScope,
      reviewedSafeException: Boolean(reviewed),
      ...(reviewed
        ? {
            reviewOwner: reviewed.owner,
            reviewExpiry: reviewed.expiry,
            reviewReason: reviewed.reason,
          }
        : {}),
      needsReview: usesAdmin && !usesMembership && !usesOrgScope && !reviewed,
    });
  }

  const staleReviewedSafeExceptions = [...reviewedSafeExceptions.keys()].filter((file) => !seenFiles.has(file));
  rows.sort((a, b) => a.file.localeCompare(b.file));
  const unreviewedCount = rows.filter((row) => row.needsReview).length;
  const reviewedSafeExceptionCount = rows.filter((row) => row.reviewedSafeException).length;

  return {
    fileCount: rows.length,
    reviewedSafeExceptionCount,
    unreviewedCount,
    staleReviewedSafeExceptions,
    rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(analyzeDbPrivilegeSurface(), null, 2));
}
