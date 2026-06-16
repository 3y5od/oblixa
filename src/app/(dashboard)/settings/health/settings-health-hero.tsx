import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { WorkspaceHealthItem, WorkspaceHealthStatus } from "@/lib/workspace-health-model";
import type { SettingsHealthPageAction } from "./settings-health-page-model";
import {
  actionCountAccent,
  heroMedallionClass,
  heroNarrativeText,
  HeroStatusIcon,
  visibleStatusLabel,
  workspaceAccentGradient,
  workspaceSemanticStatus,
  workspaceStatusHeadline,
} from "./settings-health-status-utils";

type SettingsHealthHeroProps = {
  overallStatus: WorkspaceHealthStatus;
  affectedCount: number;
  healthyCount: number;
  primaryAction: SettingsHealthPageAction;
  primaryAffectedItem: WorkspaceHealthItem | null;
  heroCtaLabel: string;
  allClearSentence: string;
};

export function SettingsHealthHero({
  overallStatus,
  affectedCount,
  healthyCount,
  primaryAction,
  primaryAffectedItem,
  heroCtaLabel,
  allClearSentence,
}: SettingsHealthHeroProps) {
  const actionAccent = actionCountAccent(overallStatus, affectedCount);
  const totalCount = affectedCount + healthyCount;

  return (
    <section
      id="workspace-health-status"
      aria-labelledby="workspace-health-headline"
      className="ui-card-hero relative overflow-hidden px-5 py-6 sm:px-7 md:px-9 md:py-8"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{ background: workspaceAccentGradient(overallStatus) }}
      />
      <div className="relative flex min-w-0 gap-4 sm:gap-5">
        <span className={heroMedallionClass(overallStatus)}>
          <HeroStatusIcon status={overallStatus} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
              Workspace status
            </p>
            <span
              aria-hidden
              className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
            />
            <StatusBadge status={workspaceSemanticStatus(overallStatus)}>
              {visibleStatusLabel(overallStatus)}
            </StatusBadge>
          </div>
          <h2
            id="workspace-health-headline"
            className="mt-3 text-[1.75rem] font-semibold leading-[1.1] text-[var(--text-primary)] sm:text-[2.125rem] md:text-[2.4rem]"
          >
            {workspaceStatusHeadline(primaryAffectedItem)}
          </h2>
          <p className="mt-3 max-w-[42rem] text-[14px] leading-[1.6] text-[var(--text-secondary)]">
            {heroNarrativeText(primaryAffectedItem, allClearSentence)}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2">
            <Link href={primaryAction.href} className="ui-btn-primary min-h-10 px-4 py-2.5 text-[12.5px]">
              <span>{affectedCount === 0 ? "Inspect health" : heroCtaLabel}</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="#support"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Inspect diagnostics
              <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform" aria-hidden />
            </a>
          </div>
        </div>
      </div>

      <dl
        aria-label="Workspace health overview"
        className="relative mt-7 grid grid-cols-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] pt-5 sm:divide-x sm:divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]"
      >
        <div className="pr-5 sm:pr-8">
          <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <span
              aria-hidden
              className="inline-flex h-2 w-2 rounded-full"
              style={{
                background: actionAccent.color,
                boxShadow: `0 0 0 3px color-mix(in oklab, ${actionAccent.boxShadowColor} 42%, transparent)`,
              }}
            />
            Needs action
          </dt>
          <dd className="mt-2 flex items-baseline gap-2">
            <span
              className="text-[2.25rem] font-semibold leading-none tabular-nums"
              style={{ color: actionAccent.color }}
            >
              {affectedCount}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">of {totalCount}</span>
          </dd>
        </div>
        <div className="pl-5 sm:pl-8">
          <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <span
              aria-hidden
              className="inline-flex h-2 w-2 rounded-full bg-[var(--success-ink)]"
              style={{ boxShadow: "0 0 0 3px color-mix(in oklab, var(--success-soft) 42%, transparent)" }}
            />
            Workflows clear
          </dt>
          <dd className="mt-2 flex items-baseline gap-2">
            <span className="text-[2.25rem] font-semibold leading-none tabular-nums text-[var(--success-ink)]">
              {healthyCount}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">of {totalCount}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
