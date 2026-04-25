/**
 * Parse `docs/v9.md` heading markers for trace-matrix tests (Tier A).
 * Supports `## N` / `## N.M` and optional `### N.M.K` sub-headings.
 */
export function parseV9DocH2SectionIds(doc: string): string[] {
  const ids: string[] = [];
  for (const line of doc.split("\n")) {
    let m = line.match(/^## (\d+\.\d+)\s+/);
    if (m) {
      ids.push(m[1]);
      continue;
    }
    m = line.match(/^## (\d+)\.\s+/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** Returns ids like `7.2.1` when the doc uses `###` sub-headings (currently none in v9.md). */
export function parseV9DocH3SectionIds(doc: string): string[] {
  const ids: string[] = [];
  for (const line of doc.split("\n")) {
    const m = line.match(/^### (\d+(?:\.\d+)+)\b/);
    if (m) ids.push(m[1]);
  }
  return ids;
}
