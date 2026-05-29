import { Search } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getFeatureFlags } from "@/lib/feature-flags";
import {
  SEARCH_GROUP_ORDER,
  type SearchGroup,
  type WorkspaceRole,
} from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import {
  toNavSurfaceInput,
  type NavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import { fallbackNavSurface } from "@/components/layout/command-palette-helpers";
import { SearchView } from "./search-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search",
  description: "Find anything in the workspace.",
  robots: { index: false, follow: false },
};

const MAX_QUERY_LENGTH = 200;

function parseFilterGroup(value: string | undefined): SearchGroup | null {
  if (!value) return null;
  return (SEARCH_GROUP_ORDER as readonly string[]).includes(value)
    ? (value as SearchGroup)
    : null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const params = await searchParams;
  const rawQ = typeof params.q === "string" ? params.q : "";
  const initialQuery = rawQ.slice(0, MAX_QUERY_LENGTH);
  const initialFilterGroup = parseFilterGroup(
    typeof params.group === "string" ? params.group : undefined
  );
  const role = (ctx.role as WorkspaceRole) ?? "viewer";

  let navSurface: NavSurfaceInput;
  try {
    const productSurface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, role);
    navSurface = toNavSurfaceInput(productSurface);
  } catch {
    navSurface = fallbackNavSurface(role, getFeatureFlags());
  }

  return (
    <div className="ui-page-stack mx-auto max-w-2xl gap-5">
      <a
        href="#search-input"
        className="ui-skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[var(--text-primary)]"
      >
        Skip to search
      </a>

      {/* Compact header — input is the primary affordance on this page, so
          the title row stays small (medallion + h1, no eyebrow, no lead).
          Medallion is 32 px and the h1 settles at 1.625rem so the title
          dominates the medallion while the input below still dominates the
          title. */}
      <header className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
        >
          <Search className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <h1 className="text-[1.625rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]">
          Search
        </h1>
      </header>

      <div id="search-input" className="scroll-mt-20">
        <SearchView
          role={role}
          navSurface={navSurface}
          initialQuery={initialQuery}
          initialFilterGroup={initialFilterGroup}
        />
      </div>
    </div>
  );
}
