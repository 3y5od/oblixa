/**
 * Merge incremental counters into org_behavior_metrics.v5_signal_quality_json.
 * Values are numeric aggregates only (no free text — avoids PII).
 */
export function mergeV5SignalQuality(
  existing: unknown,
  increments: Record<string, number>
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const out: Record<string, unknown> = { ...base };
  for (const [key, delta] of Object.entries(increments)) {
    if (!Number.isFinite(delta) || delta === 0) continue;
    const cur = typeof out[key] === "number" && Number.isFinite(out[key] as number) ? (out[key] as number) : 0;
    out[key] = cur + delta;
  }
  return out;
}
