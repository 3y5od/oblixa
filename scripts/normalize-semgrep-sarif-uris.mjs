#!/usr/bin/env node
/**
 * GitHub's SARIF ingest rejects some relative artifact URIs that contain `[` `]`
 * (Next.js dynamic segments). Percent-encode those characters in-place.
 */
import fs from "node:fs";

const inPath = process.argv[2] || "semgrep.sarif";
const raw = fs.readFileSync(inPath, "utf8");
const doc = JSON.parse(raw);

function encodeRelativeArtifactUri(uri) {
  if (typeof uri !== "string" || !uri) return uri;
  if (/^[a-z][a-z+.-]*:/i.test(uri)) return uri;
  return uri.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
}

function walk(obj) {
  if (!obj || typeof obj !== "object") return;
  if (obj.artifactLocation && typeof obj.artifactLocation.uri === "string") {
    obj.artifactLocation.uri = encodeRelativeArtifactUri(obj.artifactLocation.uri);
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") walk(v);
  }
}

walk(doc);
fs.writeFileSync(inPath, `${JSON.stringify(doc)}\n`);
console.log(JSON.stringify({ ok: true, path: inPath }, null, 2));
