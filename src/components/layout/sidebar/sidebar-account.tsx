import { LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { shellTestIds } from "@/lib/qa/test-ids";

export function SidebarMobileAccount() {
  // Mobile-only account section. On desktop the topbar account menu owns
  // sign-out (single source); the drawer keeps it under a quiet "Account" label
  // so touch users don't have to reach the topbar menu.
  return (
    <div className="border-t border-[var(--sidebar-section-border)] px-2.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <p className="ui-caps-1 px-3 pb-1.5 text-[10px]" style={{ color: "var(--sidebar-heading)" }}>
        Account
      </p>
      <form action={signOut}>
        <button
          type="submit"
          data-testid={shellTestIds.sidebarSignOut}
          className="group flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[13px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_82%,var(--sidebar-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
        >
          <LogOut size={18} strokeWidth={1.85} className="shrink-0" aria-hidden />
          <span>Sign out</span>
        </button>
      </form>
    </div>
  );
}
