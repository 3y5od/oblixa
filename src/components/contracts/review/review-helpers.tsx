import type { ReactNode } from "react";
import { Banknote, Building2, Calendar, Type } from "lucide-react";
import type { FieldReviewQueueItem, ReviewQueueFilter } from "@/lib/field-review/model";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.Z+\-]+)?$/;

export function isDateField(fieldName: string): boolean {
  return /(date|deadline|window|term|expiry|expiration|renewal)/.test(fieldName.toLowerCase());
}

/** Renders a stored value for display: ISO dates become "Jun 15, 2024"; empty
 *  values render the literal "Unknown". */
export function formatSuggestedValue(value: string | null): string {
  if (!value || value.trim().length === 0) return "Unknown";
  const trimmed = value.trim();
  if (ISO_DATE_RE.test(trimmed)) {
    const parsed = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00Z` : trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    }
  }
  return trimmed;
}

/** True when a date value also carries a non-ISO original extraction worth showing
 *  alongside the normalized date. */
export function isIsoDate(value: string | null): boolean {
  return !!value && ISO_DATE_RE.test(value.trim());
}

/** Confidence is a model extraction score, not a trust verdict; it is rendered as
 *  quiet metadata and never tinted as a status (AI boundary). */
export function confidencePct(confidence: number | null): number | null {
  if (confidence == null || Number.isNaN(confidence)) return null;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

export function sanitizeSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.\s]+$/u, "");
}

export function fieldTypeLabel(fieldName: string): string {
  const n = fieldName.toLowerCase();
  if (isDateField(n)) return "Date";
  if (/(value|fee|amount|price|cost|payment|rate)/.test(n)) return "Amount";
  if (/(counterparty|owner|party|vendor|customer|supplier)/.test(n)) return "Party";
  return "Text";
}

/** Date fields whose reviewed value feeds renewal/notice reminders + reports —
 *  surfaced as a "Drives renewals" classification chip so reviewers see the stakes. */
export function fieldDrivesRenewals(fieldName: string): boolean {
  return /(renewal|notice|termination|expir)/.test(fieldName.toLowerCase());
}

/** Humanizes a raw lifecycle enum (e.g. `pending_review` → "Pending review") for
 *  display. Raw enum strings must never reach the user. */
export function formatStatusLabel(status: string): string {
  if (status === "pending_review") return "Needs review";
  const s = status.replace(/_/g, " ").trim();
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : status;
}

/** Builds a review URL preserving the active decision + queue filter/search.
 *  Used by filter chips, "clear filters", and pagination. */
export function buildReviewHref(params: {
  page?: number;
  contract?: string | null;
  field?: string | null;
  qf?: ReviewQueueFilter;
  q?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.contract) sp.set("contract", params.contract);
  if (params.field) sp.set("field", params.field);
  if (params.qf && params.qf !== "all") sp.set("qf", params.qf);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/contracts/review?${qs}` : "/contracts/review";
}

/** Query suffix (`&qf=…&q=…`) appended to model-built queue-row hrefs so clicking
 *  a contract preserves the active queue filter/search. */
export function buildQueueParamSuffix(filter: ReviewQueueFilter, q: string): string {
  const sp = new URLSearchParams();
  if (filter !== "all") sp.set("qf", filter);
  if (q) sp.set("q", q);
  const s = sp.toString();
  return s ? `&${s}` : "";
}

/** Groups queue rows by operational owner (Unassigned last), preserving the
 *  ranked order within each group. */
export function groupQueueByOwner(
  items: FieldReviewQueueItem[]
): Array<{ owner: string; items: FieldReviewQueueItem[] }> {
  const map = new Map<string, FieldReviewQueueItem[]>();
  for (const item of items) {
    const key = item.ownerLabel || "Unassigned";
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()]
    .map(([owner, list]) => ({ owner, items: list }))
    .sort((a, b) => (a.owner === "Unassigned" ? 1 : 0) - (b.owner === "Unassigned" ? 1 : 0));
}

/** Accent-tinted square that gives a lone value a fixed visual anchor, glyph
 *  matched to the field type (§11.17). Icon is selected by conditional (not a
 *  call-assigned component) to satisfy react-hooks/static-components. */
export function FieldTypeMedallion({ fieldName, className }: { fieldName: string; className?: string }) {
  const n = fieldName.toLowerCase();
  const Icon = isDateField(n)
    ? Calendar
    : /(value|fee|amount|price|cost|payment|rate)/.test(n)
      ? Banknote
      : /(counterparty|owner|party|vendor|customer|supplier)/.test(n)
        ? Building2
        : Type;
  return (
    <span
      aria-hidden
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_20%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_32%,var(--surface-raised))] text-[var(--accent-strong)] ${className ?? ""}`.trim()}
    >
      <Icon className="h-4 w-4" strokeWidth={1.85} />
    </span>
  );
}

/** Highlights the located source snippet inside a document excerpt, with
 *  screen-reader markers around the matched span. */
export function renderExcerptWithHighlight(excerpt: string, snippet: string | null): ReactNode {
  if (!snippet) return excerpt;
  // Normalize whitespace the same way buildDocumentPreview does, so the visual
  // highlight and the model's snippetLocated caption are computed from identical
  // inputs (PDF-extracted snippets often carry irregular internal whitespace).
  const needle = snippet.replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
  if (needle.length === 0) return excerpt;
  const lower = excerpt.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return excerpt;
  return (
    <>
      {excerpt.slice(0, idx)}
      <span className="sr-only">snippet match start </span>
      <mark
        aria-hidden
        className="rounded-[3px] bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-0.5 font-medium text-[var(--text-primary)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
      >
        {excerpt.slice(idx, idx + needle.length)}
      </mark>
      <span className="sr-only">{excerpt.slice(idx, idx + needle.length)} snippet match end </span>
      {excerpt.slice(idx + needle.length)}
    </>
  );
}
