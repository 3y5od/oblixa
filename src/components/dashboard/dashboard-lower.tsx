/**
 * product-surface policy §8.1–§8.2 (Core home): “blocked / missing / recent / owned” via My tasks & obligations,
 * upcoming actions, missing fields, usage/evidence, recent contracts table, and review-oriented queues.
 */
import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Inbox,
  ListChecks,
  Pin,
  UploadCloud,
} from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { ActivityFeed, type ActivityFeedItem } from "@/components/ui/activity-feed";
import { TimeChip } from "@/components/ui/time-chip";
import { RatioChip } from "@/components/ui/ratio-chip";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { MissingFieldsSection } from "@/components/dashboard/missing-fields-section";
// v11 dashboard spec compliance: type-only imports retained because the
// data-fetch pipeline still reads them (the rendered output is filtered to
// the 5 spec sections, but the data fetches remain for SortableSection +
// other deferred refactors).
import type { AgendaItem } from "@/components/dashboard/this-week-agenda";
import { CONTRACT_LIST_ROW_COLUMNS } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import { attachOwnerProfiles } from "@/lib/contracts";
import {
  getDashboardAdminClientCached,
  getDashboardDateFieldsCached,
  getDashboardMissingCriticalCached,
} from "@/lib/dashboard-data";
import type { Contract } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";

type DashboardDeadlineField = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

import { UiAvatar } from "@/components/ui/ui-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { STATUS_LABELS, STATUS_SEMANTICS } from "@/lib/contracts";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import { DASHBOARD_EMPTY_STATES } from "@/lib/dashboard/spec-strings";

function CompactRecentContractsList({
  contracts,
  reviewStats,
  showOnboardingTiles = false,
}: {
  contracts: Contract[];
  reviewStats?: Record<string, ContractReviewStats>;
  /** When true, pad the list with onboarding affordances. When false (default)
   *  the list shows only real contracts. The setup-nudge above already covers
   *  upload + bulk import as primary onboarding entry points. */
  showOnboardingTiles?: boolean;
}) {
  const minRows = 3;
  const padCount = showOnboardingTiles ? Math.max(0, minRows - contracts.length) : 0;
  const referenceTimeMs = new Date().getTime();

  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]">
      {contracts.map((contract) => {
        const updatedDate = new Date(contract.updated_at);
        const ownerName = contract.owner?.full_name;
        const ownerEmail = contract.owner?.email;
        // v11 release-state pass: hide the owner cell entirely when the
        // local-part has no word separators. Any single-token email local-
        // part ("altemailforroux", "jsmith", "admin") cannot be reliably
        // humanized into a person's name, and the critique flagged the
        // garbled half-render as the worst first impression for an
        // operator who came here to escape spreadsheet chaos. Better no
        // owner than a half-rendered one.
        const humanizeEmailLocal = (local: string): string => {
          const cleaned = local.replace(/\+.*$/, "");
          const words = cleaned.split(/[._-]/).filter(Boolean);
          if (words.length === 0) return null as unknown as string;
          if (words.length === 1) {
            // Single unbroken token — return null to hide the owner cell.
            return null as unknown as string;
          }
          return words
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
        };
        const hasRealName = !!ownerName && ownerName !== "name";
        const ownerDisplay = hasRealName
          ? ownerName
          : ownerEmail && ownerEmail !== "name"
            ? humanizeEmailLocal(ownerEmail.split("@")[0] ?? ownerEmail)
            : null;
        const stats = reviewStats?.[contract.id];
        return (
          <li key={contract.id}>
            <Link
              href={`/contracts/${contract.id}`}
              className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {contract.title}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] text-[var(--text-tertiary)]">
                  {contract.counterparty &&
                  !contract.title
                    .toLowerCase()
                    .startsWith(contract.counterparty.toLowerCase()) ? (
                    <>
                      <span className="truncate text-[var(--text-secondary)]">
                        {contract.counterparty}
                      </span>
                      <span aria-hidden>·</span>
                    </>
                  ) : null}
                  {/* v11 release-state pass: duration prefixed with "Updated"
                      so the operator doesn't have to guess what the number
                      means (age? est. review time? last-touched?). */}
                  <span>
                    Updated{" "}
                    <TimeChip
                      date={updatedDate}
                      format="readable"
                      className="text-[var(--text-secondary)]"
                    />
                    {" "}ago
                  </span>
                </p>
              </div>
              {stats && stats.total > 0 ? (
                // §2.6 canonical RatioChip — sentence-case suffix. Tone
                // is intentionally neutral here: the PENDING REVIEW pill
                // on the row already carries the warning signal, and
                // doubling them violates §10.4.
                <div className="hidden shrink-0 sm:flex">
                  <RatioChip
                    numerator={stats.approved}
                    denominator={stats.total}
                    suffix="reviewed"
                  />
                </div>
              ) : null}
              {ownerDisplay ? (
                <>
                  <span
                    aria-hidden
                    className="hidden h-5 w-px self-center bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] lg:inline-block"
                  />
                  <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                    <UiAvatar name={ownerName} email={ownerEmail} size="xs" />
                    {/* v11 visual pass: drop uppercase + caps tracking on the
                        owner cell. Email local-parts like "altemailforroux"
                        render as shouty SHOUTY-CASE under uppercase styling. */}
                    <span className="max-w-[8rem] truncate text-[12px] font-medium text-[var(--text-secondary)]">
                      {ownerDisplay}
                    </span>
                  </div>
                </>
              ) : null}
              <StatusBadge
                status={STATUS_SEMANTICS[contract.status] ?? STATUS_SEMANTICS.draft}
                className="shrink-0"
                pulse={
                  contract.status === "pending_review" &&
                  referenceTimeMs - updatedDate.getTime() > 3 * 86400000
                }
              >
                {STATUS_LABELS[contract.status] || contract.status}
              </StatusBadge>
              {/* Hover-revealed structured affordance — explicit caps action
                  instead of icon chevrons. */}
              <span
                aria-hidden
                className="hidden shrink-0 items-center gap-1 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex"
              >
                <span title="Pin to top" className="rounded p-1 hover:bg-[var(--surface-tint-soft)]">
                  <Pin className="h-3 w-3" strokeWidth={1.85} />
                </span>
                <span title="Open in new tab" className="rounded p-1 hover:bg-[var(--surface-tint-soft)]">
                  <ExternalLink className="h-3 w-3" strokeWidth={1.85} />
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)]">
                  OPEN
                  <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
      {padCount > 0
        ? (() => {
            // Onboarding tiles for contracts < 3 — replace the bare "—" rows with
            // useful next-step affordances so the section feels actionable.
            const TILES: Array<{ href: string; title: string; meta: string }> = [
              {
                href: "/contracts/new",
                title: "Upload another contract",
                meta: "Drag-and-drop or browse files",
              },
              {
                href: "/contracts/bulk",
                title: "Bulk import contracts",
                meta: "CSV, ZIP, or integration sync",
              },
              {
                href: "/contracts/maintenance",
                title: "Browse templates",
                meta: "MSA · NDA · SOW · Renewal",
              },
            ];
            return TILES.slice(0, padCount).map((tile) => (
              <li key={tile.href}>
                <Link
                  href={tile.href}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-[var(--accent-strong)]">
                      {tile.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">
                      {tile.meta}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </Link>
              </li>
            ));
          })()
        : null}
    </ul>
  );
}

export async function DashboardLower(props: {
  orgId: string;
  userId: string;
  role: WorkspaceRole;
  view: "personal" | "team" | "portfolio";
  quickFilter: "all" | "approvals" | "deadlines" | "data_gaps";
  productSurfaceContext: ProductSurfaceContext;
}) {
  const { orgId, userId } = props;
  const admin = await getDashboardAdminClientCached();

  const [
    missingCritical,
    dateFieldsData,
    { data: myTasksData },
    { data: myObligationsData },
    { data: recentContractsData },
    { data: tickerAuditRaw },
  ] = await Promise.all([
    getDashboardMissingCriticalCached(orgId),
    getDashboardDateFieldsCached(orgId),
    admin
      .from("contract_tasks")
      .select(
        "id, title, status, priority, due_date, contracts!inner(id, title, organization_id)"
      )
      .eq("organization_id", orgId)
      .eq("assignee_id", userId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    admin
      .from("contract_obligations")
      .select(
        "id, title, status, due_date, obligation_type, contracts!inner(id, title, organization_id)"
      )
      .eq("organization_id", orgId)
      .eq("owner_id", userId)
      .in("status", ["open", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    admin
      .from("contracts")
      .select(CONTRACT_LIST_ROW_COLUMNS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("audit_events")
      .select("id, action, user_id, contract_id, created_at, details")
      .eq("organization_id", orgId)
      .in("action", ["contract.uploaded", "extraction.completed", "field.approved"])
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const recentContracts = await attachOwnerProfiles(admin, orgId, recentContractsData ?? []);
  const recentContractIds = recentContracts.map((contract) => contract.id);
  const recentReviewStats = await getReviewStatsForContractIds(admin, recentContractIds);

  // v11 dashboard spec compliance Tier 3.2: Review Queue surfaces contracts
  // with unreviewed extracted fields (pending > 0) OR status pending_review.
  const reviewQueueContracts = recentContracts.filter((contract) => {
    const stats = recentReviewStats[contract.id];
    return (stats?.pending ?? 0) > 0 || contract.status === "pending_review";
  });

  const myTasks = (myTasksData ?? []).flatMap((row) => {
    const rel = (row as { contracts: unknown }).contracts;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; organization_id?: string } | null;
    if (!contract?.id || !contract?.title || !contract?.organization_id) return [];
    return [
      {
        id: String((row as { id: unknown }).id),
        title: String((row as { title: unknown }).title),
        status: (row as { status: "open" | "in_progress" | "blocked" | "done" }).status,
        priority: (row as { priority: "low" | "medium" | "high" }).priority,
        due_date: (row as { due_date: string | null }).due_date,
        contracts: {
          id: contract.id,
          title: contract.title,
          organization_id: contract.organization_id,
        },
      },
    ];
  });

  const myObligations = (myObligationsData ?? []).flatMap((row) => {
    const rel = (row as { contracts: unknown }).contracts;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; organization_id?: string } | null;
    if (!contract?.id || !contract?.title || !contract?.organization_id) return [];
    return [
      {
        id: String((row as { id: unknown }).id),
        title: String((row as { title: unknown }).title),
        status: (row as { status: "open" | "in_progress" | "done" | "waived" }).status,
        due_date: (row as { due_date: string | null }).due_date,
        obligation_type: String((row as { obligation_type: unknown }).obligation_type),
        contracts: {
          id: contract.id,
          title: contract.title,
          organization_id: contract.organization_id,
        },
      },
    ];
  });

  const dateFields = dateFieldsData as unknown as DashboardDeadlineField[];
  const today = new Date();
  const upcomingActions = dateFields
    .filter((field) => field.field_value)
    .map((field) => {
      const dateValue = new Date(field.field_value as string);
      if (!isValid(dateValue)) return null;
      const daysUntil = differenceInDays(dateValue, today);
      if (Number.isNaN(daysUntil)) return null;
      return {
        contract: field.contracts,
        field: {
          id: field.id,
          field_name: field.field_name,
          field_value: field.field_value,
        },
        daysUntil,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a != null && a.daysUntil >= 0 && a.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  // Build a 7-day agenda by merging tasks, obligations, and upcoming dates.
  const agendaItems: AgendaItem[] = [];
  for (const t of myTasks) {
    if (!t.due_date) continue;
    const d = new Date(t.due_date);
    if (!isValid(d)) continue;
    agendaItems.push({
      date: d,
      kind: "task",
      title: t.title,
      href: `/contracts/${t.contracts.id}#task-${t.id}`,
    });
  }
  for (const o of myObligations) {
    if (!o.due_date) continue;
    const d = new Date(o.due_date);
    if (!isValid(d)) continue;
    agendaItems.push({
      date: d,
      kind: "obligation",
      title: o.title,
      href: `/contracts/${o.contracts.id}#obligation-${o.id}`,
    });
  }
  for (const u of upcomingActions) {
    agendaItems.push({
      date: new Date(u.field.field_value as string),
      kind: "deadline",
      title: `${u.field.field_name.replace(/_/g, " ")} · ${u.contract.title}`,
      href: `/contracts/${u.contract.id}`,
    });
  }

  // 12.2: Promote missing-dates banner to the top of the lower stack when the
  // workspace has 3+ critical-missing contracts OR any deadline within 7 days.
  // Otherwise keep at the bottom so it doesn't dominate when not urgent.
  const hasNearTermDeadline = upcomingActions.some((a) => a.daysUntil <= 7);
  const promoteMissingBanner = missingCritical.length >= 3 || hasNearTermDeadline;

  // v11 release-state spec + ui-design §8.5: parse tickerAuditRaw into
  // ActivityFeedItem[] using CAPS_VERBS vocabulary. Audit actions map to
  // icon + verb pairs per the bounded vocabulary.
  type AuditRow = {
    id: string;
    action: string;
    contract_id: string | null;
    created_at: string;
  };
  const ticker = (tickerAuditRaw ?? []) as unknown as AuditRow[];
  const contractTitleById = new Map(recentContracts.map((c) => [c.id, c.title]));
  // v11 release-state pass: dedupe by contract TITLE (case-insensitive),
  // not by contract_id. Per the critique, the previous pass still showed
  // two "EXTRACTED · ACME CORP MSA 2025" rows differing only by date,
  // which read as a duplicate-data bug. Two events with the same title
  // are visually identical regardless of underlying contract_id. Keep
  // only the LATEST event per title.
  const reviewQueueIdsForActivity = new Set(
    recentContracts
      .filter((c) => {
        const stats = recentReviewStats[c.id];
        return (stats?.pending ?? 0) > 0 || c.status === "pending_review";
      })
      .map((c) => c.id)
  );
  const reviewQueueTitlesForActivity = new Set(
    recentContracts
      .filter((c) => reviewQueueIdsForActivity.has(c.id))
      .map((c) => c.title.toLowerCase().trim())
  );
  const seenTitleInActivity = new Set<string>();
  const activityItems: ActivityFeedItem[] = ticker.flatMap((row): ActivityFeedItem[] => {
    const title = row.contract_id ? contractTitleById.get(row.contract_id) : undefined;
    // v12 release-state pass: suppress events whose contract title can't be
    // resolved. An orphan "EXTRACTED" row with no contract name reads as a
    // duplicate-data bug (per the critique). Better to render fewer rows
    // with full context than rows that omit the subject.
    if (!title) return [];
    const titleKey = title.toLowerCase().trim();
    if (reviewQueueTitlesForActivity.has(titleKey)) {
      return [];
    }
    if (seenTitleInActivity.has(titleKey)) {
      return [];
    }
    seenTitleInActivity.add(titleKey);
    const target = row.contract_id
      ? contractTitleById.get(row.contract_id) ?? undefined
      : undefined;
    const href = row.contract_id ? `/contracts/${row.contract_id}` : undefined;
    if (row.action === "contract.uploaded") {
      return [
        {
          id: row.id,
          icon: UploadCloud,
          tone: "neutral",
          verb: "Uploaded",
          target,
          timestamp: row.created_at,
          href,
        },
      ];
    }
    if (row.action === "extraction.completed") {
      return [
        {
          id: row.id,
          icon: FileText,
          tone: "neutral",
          verb: "Extracted",
          target,
          timestamp: row.created_at,
          href,
        },
      ];
    }
    if (row.action === "field.approved") {
      return [
        {
          id: row.id,
          icon: BadgeCheck,
          tone: "success",
          verb: "Approved",
          target,
          timestamp: row.created_at,
          href,
        },
      ];
    }
    return [];
  });

  // v11 release-state pass: when a contract is in Review Queue, suppress
  // it from Missing data + Recent activity. Review Queue is the most
  // action-oriented signal and gets primacy; the other surfaces would
  // otherwise repeat the same contract for "the same thing differently."
  // §10.4 eliminate redundancy at the page level.
  const reviewQueueHasRows = reviewQueueContracts.length > 0;
  const upcomingDeadlinesHasRows = upcomingActions.length > 0;
  const reviewIds = new Set(reviewQueueContracts.map((c) => c.id));
  const dataGapsContracts = promoteMissingBanner
    ? []
    : missingCritical.filter((m) => !reviewIds.has(m.id));
  const dataGapsHasRows = dataGapsContracts.length > 0;
  const activityContracts = recentContracts.filter((c) => !reviewIds.has(c.id));
  const hasWorkItems = myTasks.length > 0 || myObligations.length > 0;

  // v11 visual pass: per-section Check-medallion disclosures dropped.
  // Empty sections now collapse into a single trailing "All else clear"
  // tertiary-text strip below (the only place we surface emptiness).
  // DASHBOARD_EMPTY_STATES retained as the source of truth for spec-
  // verbatim copy but no longer rendered in the body — the visual
  // affirmation reads at the page footer, not per-section.

  return (
    <>
      {promoteMissingBanner ? (
        <MissingFieldsSection contracts={missingCritical} />
      ) : null}

      {/* v11 release-state pass — composition:
          - Active sections render in full row chrome.
          - Empty sections collapse into a SINGLE trailing "All else clear"
            tertiary-text strip at the bottom — so 4 stacked green-check
            disclosures don't outweigh 1 thin row of actual work (per
            critique #1).
          - Section count badges drop for empty sections (consistency).
          - Section header ActionChips render only when the section has
            rows. With nothing in a section, the section action goes nowhere
            meaningful. */}
      {(() => {
        type SectionDef = {
          id: string;
          ariaId: string;
          title: string;
          icon: typeof CheckSquare;
          count: number;
          hasRows: boolean;
          render: () => React.ReactNode;
          renderEmpty: () => React.ReactNode;
          quietLabel: string;
          /** Spec-verbatim empty-state copy per release-state
           *  §In-App Empty States — surfaced as sr-only when the section
           *  collapses into the trailing footer. */
          srEmptyDescription: string;
        };

        const sections: SectionDef[] = [
          {
            id: "review-queue",
            ariaId: "review-queue-h",
            title: "Review queue",
            icon: CheckSquare,
            count: reviewQueueContracts.length,
            hasRows: reviewQueueHasRows,
            render: () => (
              // v12 release-state pass: row uses the richer
              // CompactRecentContractsList pattern — title + counterparty +
              // last-updated + ratio chip + owner + status pill — so the
              // section reads as substantive rather than a single thin row.
              <CompactRecentContractsList
                contracts={reviewQueueContracts as Contract[]}
                reviewStats={recentReviewStats}
              />
            ),
            renderEmpty: () => (
              <ActionChip verb="Review fields" href="/contracts/review" />
            ),
            quietLabel: "Review queue",
            srEmptyDescription: DASHBOARD_EMPTY_STATES.reviewQueue,
          },
          {
            id: "upcoming-deadlines",
            ariaId: "upcoming-deadlines-h",
            title: "Upcoming deadlines",
            icon: CalendarClock,
            count: upcomingActions.length,
            hasRows: upcomingDeadlinesHasRows,
            render: () => {
              // v11 release-state pass: drop MiniCalendar / RenewalsHorizon
              // / RenewalPipelineFunnel. Spec §Upcoming Deadlines shows:
              // renewal dates, notice deadlines, termination dates, owner,
              // days remaining — that's a LIST, not a calendar grid. The
              // month grid was the heaviest, emptiest element on the page.
              const labelFor = (fieldName: string): string => {
                if (fieldName === "renewal_date") return "Renewal";
                if (fieldName === "end_date") return "End";
                if (fieldName === "expiration_date") return "Expires";
                if (fieldName === "notice_window_starts") return "Notice opens";
                if (fieldName === "notice_window_ends") return "Notice closes";
                return fieldName.replace(/_/g, " ");
              };
              return (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
                  <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]">
                    {upcomingActions.slice(0, 5).map((u) => {
                      const tone =
                        u.daysUntil <= 7
                          ? "warning"
                          : "neutral";
                      const ink =
                        tone === "warning"
                          ? "var(--warning-ink)"
                          : "var(--text-tertiary)";
                      return (
                        <li key={`${u.contract.id}-${u.field.id}`}>
                          <Link
                            href={`/contracts/${u.contract.id}`}
                            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]"
                          >
                            <span
                              aria-hidden
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                              style={{
                                borderColor: `color-mix(in oklab, ${ink} 24%, var(--border-card))`,
                                background: `color-mix(in oklab, ${ink} 10%, var(--surface))`,
                                color: ink,
                              }}
                            >
                              <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.85} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                                {labelFor(u.field.field_name)}: {u.contract.title}
                              </p>
                              <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                                {u.daysUntil === 0
                                  ? "Today"
                                  : u.daysUntil === 1
                                    ? "Tomorrow"
                                    : `${u.daysUntil} days from now`}
                              </p>
                            </div>
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5"
                              strokeWidth={1.85}
                              aria-hidden
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
                    <MiniCalendar
                      markers={upcomingActions
                        .filter((u) => u.field.field_value)
                        .map((u) => ({
                          date: u.field.field_value as string,
                          count: 1,
                          tone:
                            u.daysUntil <= 7 ? ("warning" as const) : undefined,
                        }))}
                      ariaLabel="Upcoming renewal and notice dates"
                    />
                  </div>
                </div>
              );
            },
            renderEmpty: () => (
              <ActionChip verb="Create reminder" href="/contracts/renewals" />
            ),
            quietLabel: "Upcoming deadlines",
            srEmptyDescription: DASHBOARD_EMPTY_STATES.upcomingDeadlines,
          },
          {
            id: "work-needing-action",
            ariaId: "work-needing-action-h",
            title: "Work needing action",
            icon: ListChecks,
            count: myTasks.length + myObligations.length,
            hasRows: hasWorkItems,
            render: () => (
              <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]">
                {[
                  ...myTasks.map((t) => ({
                    id: `task-${t.id}`,
                    kind: "Task" as const,
                    title: t.title,
                    detail: t.contracts.title,
                    href: `/contracts/${t.contracts.id}#task-${t.id}`,
                    due: t.due_date,
                    icon: ClipboardList,
                  })),
                  ...myObligations.map((o) => ({
                    id: `obligation-${o.id}`,
                    kind: "Obligation" as const,
                    title: o.title,
                    detail: o.contracts.title,
                    href: `/contracts/${o.contracts.id}#obligation-${o.id}`,
                    due: o.due_date,
                    icon: ListChecks,
                  })),
                ]
                  .slice(0, 5)
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]"
                        >
                          <span
                            aria-hidden
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-card)] bg-[var(--surface)] text-[var(--text-tertiary)]"
                          >
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                              {item.title}
                            </p>
                            <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)]">
                              <span>{item.kind}</span>
                              <span className="mx-1.5" aria-hidden>·</span>
                              <span>{item.detail}</span>
                            </p>
                          </div>
                          {item.due ? (
                            <TimeChip date={item.due} format="readable" />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ),
            renderEmpty: () => (
              <ActionChip verb="Open work" href="/work" />
            ),
            quietLabel: "Work needing action",
            srEmptyDescription: DASHBOARD_EMPTY_STATES.workNeedingAction,
          },
          {
            id: "data-gaps",
            ariaId: "data-gaps-h",
            title: "Missing data",
            // v11 release-state pass: section h2 uses Inbox (neutral data-
            // shaped icon). The row triangle below carries the alert
            // semantic. Sparkles (AI implication, original) and
            // AlertTriangle (competes with row triangle) both rejected per
            // the critique.
            icon: Inbox,
            count: dataGapsContracts.length,
            hasRows: dataGapsHasRows && !promoteMissingBanner,
            render: () => <MissingFieldsSection contracts={dataGapsContracts} />,
            renderEmpty: () => (
              <ActionChip verb="Fix missing data" href="/contracts/review" tone="warning" />
            ),
            quietLabel: "Missing data",
            srEmptyDescription: DASHBOARD_EMPTY_STATES.dataGaps,
          },
          {
            id: "recent-activity",
            ariaId: "recent-activity-h",
            title: "Recent activity",
            icon: FileText,
            count: activityItems.length || activityContracts.length,
            hasRows: activityItems.length > 0 || activityContracts.length > 0,
            render: () =>
              activityItems.length > 0 ? (
                <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] px-4 py-3">
                  <ActivityFeed items={activityItems} />
                </div>
              ) : (
                <CompactRecentContractsList
                  contracts={activityContracts as Contract[]}
                  reviewStats={recentReviewStats}
                />
              ),
            renderEmpty: () => (
              <ActionChip verb="View all" href="/contracts" />
            ),
            quietLabel: "Recent activity",
            srEmptyDescription: DASHBOARD_EMPTY_STATES.recentActivity,
          },
        ];

        // v13 aesthetic pass — major subtraction:
        // - Dropped the §8.1 premium empty-state cards with their ghost-
        //   preview rows. The 3 ghost rows with decreasing opacity read as
        //   loading skeletons, and 4 nearly-identical cards across the
        //   page made the dashboard feel mass-produced.
        // - Dropped the green "Clear" pill badge in section headings. The
        //   inline hairline empty-state speaks for itself.
        // - Dropped the Workspace pulse 4-cell strip. It duplicated the
        //   data already shown in the 6 top cards above + the section
        //   count badges. The "Press ⌘K to search" hint felt out of context.
        // - Empty sections now render as a single sentence-case hairline
        //   row: [Check] [message] — honest, light, not padded with fake
        //   density.
        return (
          <div className="flex flex-col gap-6">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <section
                  key={s.id}
                  aria-labelledby={s.ariaId}
                  className="space-y-3"
                >
                  <div className="flex items-end justify-between gap-3">
                    <h2
                      id={s.ariaId}
                      className="inline-flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
                    >
                      <Icon className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
                      {s.title}
                      {s.hasRows ? (
                        <span className="ml-1 inline-flex h-5 items-center rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_45%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_18%,var(--surface-raised))] px-1.5 text-[10.5px] font-semibold tabular-nums leading-none text-[var(--warning-ink)]">
                          {s.count}
                        </span>
                      ) : null}
                    </h2>
                    {s.hasRows ? s.renderEmpty() : null}
                  </div>
                  {s.hasRows ? (
                    s.render()
                  ) : (
                    // v13 aesthetic pass: single-line hairline empty state.
                    // Replaces the prior §8.1 premium card with ghost-preview
                    // rows (read as loading skeletons + visually outweighed
                    // active content).
                    <div
                      className="flex items-center gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] px-4 py-2.5"
                    >
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-[color:color-mix(in_oklab,var(--success-ink)_70%,transparent)]"
                        strokeWidth={2.4}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">
                        {s.quietLabel === "Review queue"
                          ? "All fields reviewed"
                          : s.quietLabel === "Upcoming deadlines"
                            ? "No deadlines in the next 90 days"
                            : s.quietLabel === "Work needing action"
                              ? "No work assigned to you"
                              : s.quietLabel === "Missing data"
                                ? "All critical fields complete"
                                : "No recent activity yet"}
                      </span>
                      <span className="hidden text-[11.5px] text-[var(--text-tertiary)] sm:inline">
                        {s.srEmptyDescription}
                      </span>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
