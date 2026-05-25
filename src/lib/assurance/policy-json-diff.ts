/** Shallow key-level diff for control policy version JSON (UI hints). */
export type PolicyJsonDiffEntry = {
  key: string;
  change: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

export function diffPolicyJsonObjects(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown> | null | undefined
): PolicyJsonDiffEntry[] {
  const a = previous ?? {};
  const b = current ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const skip = new Set(["schema", "published_by", "published_at"]);
  const out: PolicyJsonDiffEntry[] = [];

  for (const key of keys) {
    if (skip.has(key)) continue;
    const hasA = Object.prototype.hasOwnProperty.call(a, key);
    const hasB = Object.prototype.hasOwnProperty.call(b, key);
    if (!hasA && hasB) {
      out.push({ key, change: "added", after: b[key] });
    } else if (hasA && !hasB) {
      out.push({ key, change: "removed", before: a[key] });
    } else if (hasA && hasB) {
      const va = a[key];
      const vb = b[key];
      const sa = JSON.stringify(va);
      const sb = JSON.stringify(vb);
      if (sa !== sb) {
        out.push({ key, change: "changed", before: va, after: vb });
      }
    }
  }

  return out.sort((x, y) => x.key.localeCompare(y.key));
}
