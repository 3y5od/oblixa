import Link from "next/link";
import { AlertTriangle, ClipboardList, Layers } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { OperationalMetricChip, OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstLinkedContractId(linked: unknown): string | null {
  if (!Array.isArray(linked)) return null;
  for (const e of linked) {
    if (!e || typeof e !== "object") continue;
    const o = e as { type?: string; id?: string };
    if (o.type === "contract" && o.id && UUID_RE.test(String(o.id))) return String(o.id);
  }
  return null;
}
const STATUSES = ["open", "in_review", "resolved", "dismissed"] as const;
const FILTER_IDLE_CLASS = "ui-filter-pill";
const FILTER_ACTIVE_CLASS = "ui-filter-pill ui-filter-pill-active";

export default async function AssuranceFindingsPage(props: {
  searchParams: Promise<{ severity?: string; status?: string; findingType?: string; segmentId?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6AssuranceCore");

  const sp = await props.searchParams;
  const severity = SEVERITIES.includes(sp.severity as (typeof SEVERITIES)[number]) ? sp.severity : undefined;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status : undefined;
  const findingType = sp.findingType?.trim() || undefined;
  const segmentId = sp.segmentId?.trim() || undefined;

  let q = ctx.admin
    .from("assurance_findings")
    .select("id, title, severity, confidence, status, updated_at, finding_type, linked_entities_json")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(segmentId ? 200 : 80);

  if (severity) q = q.eq("severity", severity);
  if (status) q = q.eq("status", status);
  if (findingType) q = q.eq("finding_type", findingType);

  const [{ data: rawData }, { data: lastRun }, { data: segments }] = await Promise.all([
    q,
    ctx.admin
      .from("assurance_check_runs")
      .select(
        "id, check_type, trigger_type, completed_at, watch_signals_json, recommended_interventions_json, summary_json"
      )
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ctx.admin
      .from("segment_definitions")
      .select("id, name, key")
      .eq("organization_id", ctx.orgId)
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(80),
  ]);

  let contractAllow: Set<string> | null = null;
  if (segmentId) {
    const { data: mem } = await ctx.admin
      .from("segment_memberships")
      .select("entity_ref_id")
      .eq("organization_id", ctx.orgId)
      .eq("segment_definition_id", segmentId)
      .eq("entity_type", "contract")
      .limit(2000);
    contractAllow = new Set((mem ?? []).map((m) => String((m as { entity_ref_id: string }).entity_ref_id)));
  }

  const data =
    contractAllow && contractAllow.size > 0
      ? (rawData ?? []).filter((row) => {
          const linked = row.linked_entities_json as { type?: string; id?: string }[] | null;
          if (!Array.isArray(linked)) return false;
          return linked.some(
            (e) => e.type === "contract" && e.id && contractAllow!.has(String(e.id))
          );
        })
      : contractAllow && contractAllow.size === 0
        ? []
        : rawData;

  const base = "/assurance/findings";
  const apiFindingsJsonHref = (() => {
    const p = new URLSearchParams();
    if (severity) p.set("severity", severity);
    if (status) p.set("status", status);
    if (findingType) p.set("findingType", findingType);
    const qs = p.toString();
    return qs ? `/api/assurance/findings?${qs}` : "/api/assurance/findings";
  })();
  function filterHref(patch: Partial<{ severity: string | null; status: string | null; findingType: string | null; segmentId: string | null }>) {
    const p = new URLSearchParams();
    const sev = patch.severity !== undefined ? patch.severity : severity;
    const st = patch.status !== undefined ? patch.status : status;
    const ft = patch.findingType !== undefined ? patch.findingType : findingType;
    const sg = patch.segmentId !== undefined ? patch.segmentId : segmentId;
    if (sev) p.set("severity", sev);
    if (st) p.set("status", st);
    if (ft) p.set("findingType", ft);
    if (sg) p.set("segmentId", sg);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  }
  const watch = Array.isArray(lastRun?.watch_signals_json) ? (lastRun!.watch_signals_json as string[]) : [];
  const rec = Array.isArray(lastRun?.recommended_interventions_json)
    ? (lastRun!.recommended_interventions_json as string[])
    : [];
  const segRollups = (lastRun?.summary_json as { segment_rollups?: unknown } | null)?.segment_rollups;

  const rows = data ?? [];
  const openRows = rows.filter((r) => r.status === "open" || r.status === "in_review").length;
  const criticalRows = rows.filter((r) => r.severity === "critical").length;
  const rowCap = segmentId ? 200 : 80;

  return (
    <AssuranceListCard
      title="Findings queue"
      subtitle="Assurance"
      explainer={
        <p>
          Each finding includes rule path, confidence, impacted entities, and recommended next action. Triage by severity
          and status filters below; segment filters are UI-only (use contract links from each row).
        </p>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <OperationalSummaryCard
          eyebrow="Filtered"
          headline="Rows shown"
          tone="neutral"
          icon={Layers}
          primaryValue={rows.length}
          primaryUnit="in this view"
          action={{ href: "/assurance/findings", label: "Clear filters" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Queue"
          headline="Open / in review"
          tone={openRows > 0 ? "attention" : "healthy"}
          icon={ClipboardList}
          primaryValue={openRows}
          primaryUnit="needs triage"
          action={{ href: "/assurance/findings?status=open", label: "View open" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Risk"
          headline="Critical severity"
          tone={criticalRows > 0 ? "risk" : "healthy"}
          icon={AlertTriangle}
          primaryValue={criticalRows}
          primaryUnit="in sample"
          action={{ href: "/assurance/findings?severity=critical", label: "Filter critical" }}
          variant="compact"
        />
      </div>
      <p className="ui-support-copy mt-1">
        This view loads at most {rowCap} findings (most recently updated first). Narrow filters may hide older rows; use
        exports or API for full history.
      </p>
      {lastRun ? (
        <div className="ui-surface-tint mb-4 rounded-[var(--radius-2xl)] p-4">
          <p className="ui-eyebrow">Latest run</p>
          <p className="ui-section-title mt-1 text-base">Assurance check</p>
          <p className="ui-support-copy mt-1">Use the latest run as the context layer for why the current queue is elevated, which signals are firing, and which interventions are being suggested.</p>
          <div className="mt-2 flex flex-wrap gap-2" role="list">
            <OperationalMetricChip
              label="Type"
              value={`${String(lastRun.check_type)} · ${String(lastRun.trigger_type)}`}
            />
            {lastRun.completed_at ? (
              <OperationalMetricChip label="Completed" value={String(lastRun.completed_at).slice(0, 19)} />
            ) : null}
            {watch.length > 0 ? (
              <OperationalMetricChip label="Watch signals" value={watch.slice(0, 3).join(", ")} />
            ) : null}
            {rec.length > 0 ? (
              <OperationalMetricChip label="Recommended" value={rec.slice(0, 2).join(", ")} />
            ) : null}
          </div>
          {Array.isArray(segRollups) && segRollups.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2" role="list">
              {(segRollups as { name?: string; member_count?: number }[])
                .slice(0, 6)
                .map((s, i) => (
                  <OperationalMetricChip
                    key={`${s.name ?? i}`}
                    label={s.name ?? "Segment"}
                    value={String(s.member_count ?? 0)}
                  />
                ))}
            </div>
          ) : null}
          {(lastRun as { id?: string }).id ? (
            <p className="mt-2">
              <ApiJsonLink
                className="ui-link"
                href={`/api/assurance/check-runs/${encodeURIComponent(String((lastRun as { id: string }).id))}`}
              >
                Open this run JSON
              </ApiJsonLink>
              {" · "}
              <ApiJsonLink className="ui-link" href="/api/assurance/check-runs?limit=40">
                All recent check runs
              </ApiJsonLink>
            </p>
          ) : (
            <p className="mt-2">
              <ApiJsonLink className="ui-link" href="/api/assurance/check-runs?limit=40">
                Recent check runs (JSON)
              </ApiJsonLink>
            </p>
          )}
        </div>
      ) : (
        <p className="mb-4 text-xs text-[var(--text-tertiary)]">
          <ApiJsonLink className="ui-link" href="/api/assurance/check-runs?limit=40">
            Browse assurance check runs
          </ApiJsonLink>
        </p>
      )}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--text-secondary)]">Segment (contracts in segment)</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            className={!segmentId ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}
            href={filterHref({ segmentId: null })}
          >
            Any segment
          </Link>
          {(segments ?? []).map((seg) => {
            const id = String((seg as { id: string }).id);
            return (
              <Link
                key={id}
                className={segmentId === id ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}
                href={filterHref({ segmentId: id })}
              >
                {(seg as { name: string }).name}
              </Link>
            );
          })}
        </div>
        <p className="text-xs font-medium text-[var(--text-secondary)]">Severity / status</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            className={!severity && !status && !findingType && !segmentId ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}
            href={base}
          >
            All
          </Link>
          {SEVERITIES.map((s) => (
            <Link
              key={s}
              className={severity === s ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}
              href={filterHref({ severity: s })}
            >
              {s}
            </Link>
          ))}
          {STATUSES.map((s) => (
            <Link
              key={s}
              className={status === s ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}
              href={filterHref({ status: s })}
            >
              {s}
            </Link>
          ))}
        </div>
        <p className="text-xs font-medium text-[var(--text-secondary)]">Finding type</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            className={!findingType ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}
            href={filterHref({ findingType: null })}
          >
            Any type
          </Link>
          {[
            "policy_compliance",
            "ownership_coverage",
            "approval_sla",
            "campaign_drift",
            "exception_recurrence",
            "external_response_miss",
          ].map((t) => (
            <Link
              key={t}
              className={findingType === t ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}
              href={filterHref({ findingType: t })}
            >
              {t.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--text-secondary)]">
        <ApiJsonLink className="ui-link" href={apiFindingsJsonHref}>
          Matching findings (JSON)
        </ApiJsonLink>
        {" · "}
        <ApiJsonLink className="ui-link" href="/api/assurance/findings?status=open">
          Open findings (JSON)
        </ApiJsonLink>
        {" · "}
        <ApiJsonLink className="ui-link" href="/api/assurance/analytics/summary">
          Assurance analytics summary
        </ApiJsonLink>
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {(data ?? []).map((row) => {
          const cid = firstLinkedContractId(row.linked_entities_json);
          return (
            <li key={row.id} className="ui-support-panel p-3">
              <Link className="font-medium text-[var(--text-primary)] hover:underline" href={`/assurance/findings/${row.id}`}>
                {row.title}
              </Link>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {row.finding_type} · Severity {row.severity} · Confidence {row.confidence} · Status {row.status}
                {cid ? (
                  <>
                    {" · "}
                    <Link className="ui-link" href={`/contracts/${cid}`}>
                      Linked contract
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
        {(data ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No findings match.</li> : null}
      </ul>
    </AssuranceListCard>
  );
}
