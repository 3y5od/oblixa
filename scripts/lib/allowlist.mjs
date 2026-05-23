#!/usr/bin/env node

import fs from "node:fs";

export function parseKeyValueMetadata(raw) {
  const matches = [...raw.matchAll(/\b([A-Za-z][A-Za-z0-9_-]*)=/gu)];
  const meta = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = match[1];
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd =
      index + 1 < matches.length ? matches[index + 1].index ?? raw.length : raw.length;
    meta[key] = raw.slice(valueStart, valueEnd).trim();
  }
  return meta;
}

export function loadAllowlistWithMetadata(filePath) {
  if (!fs.existsSync(filePath)) {
    return { entries: new Set(), metadataIssues: [] };
  }

  const text = fs.readFileSync(filePath, "utf8");
  const entries = new Set();
  const metadataIssues = [];
  let currentMeta = null;

  for (const [idx, rawLine] of text.split("\n").entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const match = line.match(/^#\s*meta:\s*(?<body>.*)$/u);
      if (match?.groups?.body) {
        const meta = parseKeyValueMetadata(match.groups.body);
        if (!meta.owner || !meta.expiry || !meta.reason) {
          metadataIssues.push({ line: idx + 1, issue: "invalid_allowlist_meta", meta });
          currentMeta = null;
          continue;
        }
        currentMeta = {
          owner: meta.owner,
          expiry: meta.expiry,
          reason: meta.reason.trim(),
          reviewedOn: meta.reviewedOn ?? meta.reviewDate ?? meta.lastReviewed ?? null,
        };
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
