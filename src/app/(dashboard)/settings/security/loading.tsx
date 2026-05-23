import { ShieldCheck } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/security-page-maximal-pass.md §5.4 — loading boundary
// matching the post-pass page shape: page-header skeleton + 5 card
// skeletons (resources, MFA, sessions, step-up, org-MFA policy).
export default function SecurityLoading() {
  return (
    <div className="ui-page-stack mx-auto max-w-4xl gap-4" aria-busy="true">
      <span aria-hidden className="ui-skeleton h-7 w-32 rounded-full" />
      <DashboardPageHeader
        icon={
          <ShieldCheck
            className="h-[1.125rem] w-[1.125rem]"
            strokeWidth={1.85}
          />
        }
        eyebrow={SETTINGS_SECURITY_STRINGS.eyebrow}
        title={SETTINGS_SECURITY_STRINGS.title}
        lead={SETTINGS_SECURITY_STRINGS.lead}
        metaStrip={
          <>
            <span aria-hidden className="ui-skeleton h-4 w-20 rounded" />
            <span aria-hidden className="ui-skeleton h-4 w-24 rounded" />
          </>
        }
      />

      {/* Resources card skeleton */}
      <section className="ui-card ui-loading-panel p-0">
        <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
          <span aria-hidden className="ui-skeleton block h-3 w-20 rounded" />
          <span aria-hidden className="ui-skeleton mt-2 block h-6 w-32 rounded" />
        </div>
        <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="ui-skeleton h-7 w-full rounded-full"
            />
          ))}
        </div>
      </section>

      {/* MFA + step-up 2-col skeleton */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className="ui-card ui-loading-panel p-0">
            <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
              <span aria-hidden className="ui-skeleton block h-3 w-12 rounded" />
              <span aria-hidden className="ui-skeleton mt-2 block h-5 w-36 rounded" />
            </div>
            <div className="space-y-3 px-5 py-4">
              <span aria-hidden className="ui-skeleton h-4 w-full rounded" />
              <span aria-hidden className="ui-skeleton h-9 w-32 rounded-full" />
            </div>
          </section>
        ))}
      </div>

      {/* Sessions card skeleton */}
      <section className="ui-card ui-loading-panel p-0">
        <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
          <span aria-hidden className="ui-skeleton block h-3 w-16 rounded" />
          <span aria-hidden className="ui-skeleton mt-2 block h-5 w-32 rounded" />
        </div>
        <div className="space-y-3 px-5 py-4">
          <span aria-hidden className="ui-skeleton h-4 w-3/4 rounded" />
          <span aria-hidden className="ui-skeleton h-9 w-48 rounded-full" />
        </div>
      </section>

      {/* Workspace policy card skeleton */}
      <section className="ui-card ui-loading-panel p-0">
        <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
          <span aria-hidden className="ui-skeleton block h-3 w-16 rounded" />
          <span aria-hidden className="ui-skeleton mt-2 block h-5 w-32 rounded" />
        </div>
        <div className="space-y-3 px-5 py-4">
          <span aria-hidden className="ui-skeleton h-4 w-3/4 rounded" />
          <span aria-hidden className="ui-skeleton h-5 w-40 rounded-full" />
        </div>
      </section>

      {/* V2 §1.43 — activity-strip skeleton matches rendered layout
          (eyebrow + icon + caps + button cluster) to avoid CLS. */}
      <section
        aria-hidden
        className="ui-loading-panel flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5"
      >
        <span className="ui-skeleton h-3 w-16 rounded" />
        <span className="ui-skeleton h-3 w-px" />
        <span className="ui-skeleton h-4 w-48 rounded" />
        <span className="ui-skeleton h-3 w-px" />
        <span className="ui-skeleton h-3 w-32 rounded" />
        <span className="ml-auto ui-skeleton h-5 w-24 rounded-full" />
      </section>
    </div>
  );
}
