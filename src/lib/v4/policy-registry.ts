function appliesToApproval(entry: Record<string, unknown>): boolean {
  const applies = entry.applies_to;
  return (
    applies === undefined ||
    (Array.isArray(applies) && (applies as unknown[]).some((x) => String(x) === "approval"))
  );
}

export function validatePolicyRegistry(registry: unknown): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(registry)) {
    return { ok: false, error: "Policy registry must be a JSON array" };
  }
  const ids = new Set<string>();
  for (let i = 0; i < registry.length; i++) {
    const entry = registry[i];
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: `Entry ${i} must be an object` };
    }
    const id = String((entry as Record<string, unknown>).id ?? "").trim();
    if (!id) {
      return { ok: false, error: `Entry ${i} is missing id` };
    }
    if (ids.has(id)) {
      return { ok: false, error: `Duplicate policy id: ${id}` };
    }
    ids.add(id);
  }
  return { ok: true };
}

/**
 * Non-fatal governance hints. Call only after validatePolicyRegistry succeeds.
 */
export function analyzePolicyRegistry(registry: unknown): string[] {
  if (!Array.isArray(registry)) {
    return ["Registry must be a JSON array."];
  }
  const validated = validatePolicyRegistry(registry);
  if (!validated.ok) {
    return [];
  }
  const warnings: string[] = [];
  let approvalPositiveSlaCount = 0;
  for (const row of registry) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? "?");
    if (appliesToApproval(o)) {
      const hours = o.sla_hours;
      if (typeof hours === "number" && Number.isFinite(hours) && hours > 0) {
        approvalPositiveSlaCount++;
      } else if (hours !== undefined && (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0)) {
        warnings.push(
          `Entry "${id}" is approval-scoped but sla_hours is not a positive number (ignored for SLA fallback).`
        );
      }
    }
    const applies = o.applies_to;
    if (Array.isArray(applies)) {
      const tags = (applies as unknown[]).map((x) => String(x));
      const touchesRenewalOrObligation = tags.some((t) => t === "renewal" || t === "obligation");
      if (touchesRenewalOrObligation) {
        const hasSeverity = typeof o.severity === "string" && o.severity.trim().length > 0;
        const hasSla = typeof o.sla_hours === "number" && Number.isFinite(o.sla_hours) && o.sla_hours > 0;
        const hasNotes = typeof o.notes === "string" && o.notes.trim().length > 0;
        if (!hasSeverity && !hasSla && !hasNotes) {
          warnings.push(
            `Entry "${id}" applies to renewal or obligation but has no severity, positive sla_hours, or notes — clarify intent.`
          );
        }
      }
    }
  }
  if (approvalPositiveSlaCount > 1) {
    warnings.push(
      `Multiple entries (${approvalPositiveSlaCount}) define a positive approval SLA fallback; the first matching row wins when the cron resolves defaults.`
    );
  }
  return warnings;
}

/** First matching SLA hours from registry entries that apply to approvals. */
export function getApprovalSlaFallbackHours(registry: unknown): number | null {
  if (!Array.isArray(registry)) return null;
  for (const row of registry) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (!appliesToApproval(o)) continue;
    const hours = o.sla_hours;
    if (typeof hours === "number" && Number.isFinite(hours) && hours > 0) {
      return Math.round(hours);
    }
  }
  return null;
}
