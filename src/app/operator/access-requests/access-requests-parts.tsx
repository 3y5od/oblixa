import { ShieldAlert } from "lucide-react";
import type { AccessRequestEventRow, AccessGrantRow, AccessRequestRow } from "@/lib/access-review";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function statusClass(status: string): string {
  const base = "inline-flex max-w-max items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.12em]";
  if (status === "approved" || status === "issued") {
    return `${base} border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface))] text-[var(--success-ink)]`;
  }
  if (status === "rejected" || status === "revoked" || status === "expired") {
    return `${base} border-[color:color-mix(in_oklab,var(--danger)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_28%,var(--surface))] text-[var(--danger-ink)]`;
  }
  if (status === "used" || status === "closed") {
    return `${base} border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]`;
  }
  return `${base} border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface))] text-[var(--warning-ink)]`;
}

export function latestGrantForRequest(grants: AccessGrantRow[], requestId: string): AccessGrantRow | null {
  return grants.find((grant) => grant.request_id === requestId) ?? null;
}

export function eventsForRequest(events: AccessRequestEventRow[], requestId: string): AccessRequestEventRow[] {
  return events.filter((event) => event.request_id === requestId).slice(0, 5);
}

type FitTone = "success" | "warning" | "danger" | "neutral";

function fitChipClass(tone: FitTone): string {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium";
  if (tone === "success")
    return `${base} border-[color:color-mix(in_oklab,var(--success)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_24%,var(--surface))] text-[var(--success-ink)]`;
  if (tone === "warning")
    return `${base} border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_24%,var(--surface))] text-[var(--warning-ink)]`;
  if (tone === "danger")
    return `${base} border-[color:color-mix(in_oklab,var(--danger)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_24%,var(--surface))] text-[var(--danger-ink)]`;
  return `${base} border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]`;
}

function submissionValue(json: AccessRequestRow["last_submission_json"], key: string): string {
  const v = json?.[key];
  return typeof v === "string" ? v.trim() : "";
}

export function FitContext({ request }: { request: AccessRequestRow }) {
  const json = request.last_submission_json;
  const owner = submissionValue(json, "accountable_owner");
  const smallSet = submissionValue(json, "small_first_set");
  const procurement = submissionValue(json, "procurement_before_upload");
  const sample = (request.redacted_sample_available ?? "").trim();
  const yn = (v: string) => (v === "unsure" ? "?" : v);
  const procurementBlocker = procurement === "yes";

  const chips: Array<{ key: string; label: string; tone: FitTone }> = [];
  if (owner)
    chips.push({
      key: "owner",
      label: owner === "self" ? "Owner ready" : owner === "named" ? "Owner named" : "Owner TBD",
      tone: owner === "self" ? "success" : owner === "named" ? "neutral" : "warning",
    });
  if (smallSet)
    chips.push({
      key: "small",
      label: `Small set: ${yn(smallSet)}`,
      tone: smallSet === "yes" ? "success" : smallSet === "no" ? "warning" : "neutral",
    });
  if (sample)
    chips.push({
      key: "sample",
      label: `Sample: ${yn(sample)}`,
      tone: sample === "yes" ? "success" : "neutral",
    });
  if (procurement && !procurementBlocker)
    chips.push({
      key: "proc",
      label: procurement === "maybe" ? "Procurement maybe" : "No procurement",
      tone: procurement === "maybe" ? "warning" : "success",
    });

  if (chips.length === 0 && !procurementBlocker) return null;
  return (
    <div className="mt-2">
      <p className="ui-caps-2 text-[9px] text-[var(--text-tertiary)]">Fit context</p>
      {procurementBlocker ? (
        <span
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold text-[var(--danger-ink)]"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 40%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--danger-soft) 36%, var(--surface))",
          }}
        >
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Procurement dependency — security review before upload
        </span>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span key={chip.key} className={fitChipClass(chip.tone)}>
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function GrantStatus({ grant }: { grant: AccessGrantRow | null }) {
  if (!grant) return <span className="ui-muted-tight text-xs">No grant issued</span>;
  return (
    <span className={`${statusClass(grant.status)} text-[11px]`}>
      {grant.status}
      <span className="ml-1 font-normal normal-case tracking-normal">until {formatDateTime(grant.expires_at)}</span>
    </span>
  );
}
