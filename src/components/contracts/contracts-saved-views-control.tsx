import Link from "next/link";
import { Bookmark, ChevronDown, Eye, Trash2 } from "lucide-react";
import { PortaledPopover } from "@/components/contracts/portaled-popover";
import { ContractsSavedViewCreateForm } from "@/components/contracts/contracts-saved-view-create-form";
import { deleteSavedView } from "@/actions/saved-views";

/**
 * The contracts saved-views control, extracted verbatim from the page so it can
 * ride in the shared FilterBar's `rightExtra` slot (passed as server content into
 * the client ContractsFilterBar). Trigger shows the active view's name; the
 * popover lists views with delete + a "save current view" form. Stays a server
 * component because the delete action binds a server action and the create form
 * is server-rendered.
 */

export interface ContractsSavedViewRow {
  id: string;
  name: string;
  href: string;
  weeklyActive: boolean;
  monthlyActive: boolean;
  recipientsCsv: string;
}

export interface ContractsSavedViewDefaults {
  search: string;
  status: string;
  owner: string;
  counterparty: string;
  contract_type: string;
  region: string;
  deadline: string;
  sort: string;
  exceptions: string;
  review: string;
  data_quality: string;
  evidence: string;
  work: string;
}

export interface ContractsSavedViewsControlProps {
  savedViews: ContractsSavedViewRow[];
  activeSavedView: ContractsSavedViewRow | undefined;
  orgId: string;
  canEdit: boolean;
  defaults: ContractsSavedViewDefaults;
}

export function ContractsSavedViewsControl({
  savedViews,
  activeSavedView,
  orgId,
  canEdit,
  defaults,
}: ContractsSavedViewsControlProps) {
  return (
    <PortaledPopover
      ariaLabel="Saved views"
      align="right"
      widthClassName="w-[22rem]"
      triggerClassName={`ui-toolbar-dropdown${activeSavedView ? " !border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-subtle))] !text-[var(--accent-strong)]" : ""}`}
      triggerContent={
        <>
          {/* Bookmark (not the Filters sliders) keeps Saved views
              visually distinct; an accent tint marks an applied view. */}
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          <span className="max-w-[10rem] truncate">{activeSavedView?.name ?? "All contracts"}</span>
          <ChevronDown className="popover-caret h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </>
      }
    >
      <ul className="space-y-1">
        {/* Only show the "All contracts" reset row when a saved view is
            currently active — otherwise it duplicates the trigger label. */}
        {activeSavedView ? (
          <li>
            <Link
              href="/contracts"
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)]"
            >
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                Reset to all contracts
              </span>
            </Link>
          </li>
        ) : null}
        {!activeSavedView && savedViews.length === 0 ? (
          <li className="flex flex-col items-center gap-1 px-2 py-3">
            <Eye
              className="h-3.5 w-3.5 text-[var(--text-tertiary)]"
              strokeWidth={1.85}
              aria-hidden
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              No saved views
            </span>
          </li>
        ) : null}
        {savedViews.map((view) => (
          <li key={view.id} className="group flex items-center gap-1">
            <Link
              href={view.href}
              className={`flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)] ${activeSavedView?.id === view.id ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]" : "text-[var(--text-secondary)]"}`}
            >
              <span className="truncate">{view.name}</span>
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {view.weeklyActive ? <span title="Weekly summary on">W</span> : null}
                {view.monthlyActive ? <span title="Monthly summary on">M</span> : null}
              </span>
            </Link>
            <form action={deleteSavedView.bind(null, view.id) as never}>
              <button
                type="submit"
                aria-label={`Delete saved view ${view.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_14%,transparent)] hover:text-[var(--danger-ink)]"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.85} aria-hidden />
              </button>
            </form>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-2.5">
        <p className="ui-popover-section-heading">Save current view</p>
        <ContractsSavedViewCreateForm
          organizationId={orgId}
          canEdit={canEdit}
          defaults={defaults}
        />
      </div>
    </PortaledPopover>
  );
}
