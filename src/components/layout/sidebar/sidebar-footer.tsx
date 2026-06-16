import { Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { shellTestIds } from "@/lib/qa/test-ids";
import { DESKTOP_SIDEBAR_BODY_ID } from "./constants";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  operator: "Operator",
};

/**
 * Stable bottom utility bar for the desktop rail. It anchors the collapse
 * control in one fixed position (instead of floating it near the brand) and
 * carries a quiet workspace-role indicator — the only shell state allowed here.
 * The full account menu deliberately lives in the topbar (single source), so
 * this footer never duplicates it.
 */
export function SidebarFooter({
  collapsed,
  isOnboarding,
  role,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  isOnboarding: boolean;
  role?: string | null;
  onToggleCollapsed: () => void;
}) {
  const roleLabel = role?.trim() ? (ROLE_LABEL[role.trim().toLowerCase()] ?? null) : null;

  if (collapsed) {
    return (
      <div className="flex h-12 shrink-0 items-center justify-center border-t border-[var(--sidebar-section-border)] px-2">
        {isOnboarding ? null : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            data-testid={shellTestIds.sidebarCollapseToggle}
            className="inline-flex h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
            aria-controls={DESKTOP_SIDEBAR_BODY_ID}
            aria-expanded={false}
            aria-label="Expand sidebar"
            title="Expand sidebar (⌘\\)"
          >
            <PanelLeftOpen size={18} strokeWidth={1.85} aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-t border-[var(--sidebar-section-border)] px-3">
      {roleLabel ? (
        <span
          className="inline-flex min-w-0 items-center gap-1.5 text-[var(--sidebar-muted)]"
          aria-label={`Your role in this workspace: ${roleLabel}`}
          title={`Your role in this workspace: ${roleLabel}`}
        >
          <Building2 size={14} strokeWidth={1.85} className="shrink-0" aria-hidden />
          <span className="truncate text-[11.5px] font-medium leading-tight" aria-hidden>
            {roleLabel}
          </span>
        </span>
      ) : (
        <span aria-hidden />
      )}
      {isOnboarding ? null : (
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid={shellTestIds.sidebarCollapseToggle}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
          aria-controls={DESKTOP_SIDEBAR_BODY_ID}
          aria-expanded={true}
          aria-label="Collapse sidebar"
          title="Collapse sidebar (⌘\\)"
        >
          <PanelLeftClose size={18} strokeWidth={1.85} aria-hidden />
        </button>
      )}
    </div>
  );
}
