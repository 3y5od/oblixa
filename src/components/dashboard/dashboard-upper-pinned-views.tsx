import Link from "next/link";
import { Bookmark } from "lucide-react";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
import type { DashboardPinnedCommandView } from "./dashboard-upper-focus-cards";

export function DashboardUpperPinnedViews({
  commandViewLinks,
  manageSavedViewsHref,
}: {
  commandViewLinks: DashboardPinnedCommandView[];
  manageSavedViewsHref: string;
}) {
  if (commandViewLinks.length === 0) {
    return null;
  }

  return (
    <section className="ui-page-shell space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="landing-eyebrow-dot" aria-hidden />
            Saved
          </p>
          <h2 className="ui-section-title mt-2 text-[1.25rem]">Pinned command views</h2>
          <p className="ui-section-lead mt-2">Keep recurring queue configurations one click away.</p>
        </div>
        <Link href={manageSavedViewsHref} className="ui-link inline-flex items-center gap-1 text-xs">
          Manage saved views
          <span aria-hidden>{"\u2192"}</span>
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {commandViewLinks.map((row) => (
          <OperationalSurfaceLinkCard
            key={row.id}
            href={row.href}
            eyebrow="Saved view"
            title={row.name}
            icon={Bookmark}
            tone="neutral"
            chips={[{ label: "Type", value: row.viewType }]}
            actionLabel="Load saved view"
          />
        ))}
      </div>
    </section>
  );
}
