#!/usr/bin/env node

import fs from "node:fs";

export function loadAllowlistWithMetadata(filePath) {
  if (!fs.existsSync(filePath)) {
    return { entries: new Set(), metadataIssues: [] };
  }

  const text = fs.readFileSync(filePath, "utf8");
  const entries = new Set();
  const metadataIssues = [];
  const metaRe =
    /^#\s*meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=(.+)$/;
  let currentMeta = null;

  for (const [idx, rawLine] of text.split("\n").entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const match = line.match(metaRe);
      if (match) {
        currentMeta = { owner: match[1], expiry: match[2], reason: match[3].trim() };
        const parsed = Date.parse(currentMeta.expiry);
        if (Number.isNaN(parsed) || parsed < Date.now()) {
          metadataIssues.push({ line: idx + 1, issue: "expired_allowlist_meta", meta: currentMeta });
        }
      }
      continue;
    }
    if (!currentMeta) {
      metadataIssues.push({ line: idx + 1, issue: "missing_allowlist_meta", entry: line });
    }
    entries.add(line);
  }

  return { entries, metadataIssues };
}
