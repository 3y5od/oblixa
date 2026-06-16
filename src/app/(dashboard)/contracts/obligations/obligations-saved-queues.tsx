import Link from "next/link";
import { Inbox, Pin, Save } from "lucide-react";
import {
  createSavedView,
  deleteSavedView,
  setSavedViewPinned,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  ObligationStatusFilter,
  SavedObligationView,
} from "@/app/(dashboard)/contracts/obligations/obligations-page-types";

export function SavedObligationQueues({
  onlyMine,
  orgId,
  savedViews,
  status,
}: {
  onlyMine: boolean;
  orgId: string;
  savedViews: SavedObligationView[];
  status: ObligationStatusFilter;
}) {
  return (
    <div className="ui-card min-w-0 overflow-hidden p-0">
      <SectionHeader
        eyebrow="Saved queues"
        trailing={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <Save className="h-3 w-3" strokeWidth={1.85} aria-hidden />
            {savedViews.length} saved
          </span>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <SaveQueueForm onlyMine={onlyMine} orgId={orgId} status={status} />
        {savedViews.length > 0 ? <SavedQueueList savedViews={savedViews} /> : <SavedQueueEmptyState />}
      </div>
    </div>
  );
}

function SaveQueueForm({
  onlyMine,
  orgId,
  status,
}: {
  onlyMine: boolean;
  orgId: string;
  status: ObligationStatusFilter;
}) {
  return (
    <form action={createSavedView as never} className="space-y-2">
      <input type="hidden" name="organizationId" value={orgId} />
      <input type="hidden" name="viewType" value="obligations" />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="mine" value={onlyMine ? "1" : ""} />
      <label
        htmlFor="obligation-view-name"
        className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
      >
        Queue name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          aria-label="My open requirements"
          id="obligation-view-name"
          name="name"
          required
          placeholder="My open requirements"
          className="ui-input min-w-0 flex-1"
        />
        <button type="submit" className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
          <Save className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          Save queue
        </button>
      </div>
    </form>
  );
}

function SavedQueueList({ savedViews }: { savedViews: SavedObligationView[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] border-y border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]" aria-label="Saved requirement queues">
      {savedViews.map((view) => (
        <li key={view.id} className="space-y-2 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={view.href} className="ui-link text-[12.5px] font-semibold">
              {view.name}
            </Link>
            <div className="flex flex-wrap gap-1.5">
              {view.pinned ? <StatusPill tone="success">Pinned</StatusPill> : null}
              <StatusPill tone={view.weeklyActive ? "success" : "neutral"}>
                {view.weeklyActive ? "Weekly on" : "Weekly off"}
              </StatusPill>
            </div>
          </div>
          <SavedQueueActions view={view} />
        </li>
      ))}
    </ul>
  );
}

function SavedQueueActions({ view }: { view: SavedObligationView }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <form action={setSavedViewPinned.bind(null, view.id, !view.pinned) as never}>
        <button
          type="submit"
          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
          aria-label={`${view.pinned ? "Unpin" : "Pin"} saved requirement queue ${view.name}`}
        >
          <Pin className="h-3 w-3" aria-hidden />
          {view.pinned ? "Unpin" : "Pin"}
        </button>
      </form>
      <form action={setSavedViewWeeklySummary.bind(null, view.id, !view.weeklyActive) as never}>
        <button
          type="submit"
          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
          aria-label={`${view.weeklyActive ? "Disable" : "Enable"} weekly summary for ${view.name}`}
        >
          {view.weeklyActive ? "Disable weekly" : "Enable weekly"}
        </button>
      </form>
      <form action={deleteSavedView.bind(null, view.id) as never}>
        <button
          type="submit"
          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-[var(--danger-ink)]"
          aria-label={`Delete saved requirement queue ${view.name}`}
        >
          Delete
        </button>
      </form>
    </div>
  );
}

function SavedQueueEmptyState() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,transparent)] px-4 py-3">
      <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
          No saved queues yet
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Bookmark the current filter set when it becomes a recurring view.
        </p>
      </div>
    </div>
  );
}
