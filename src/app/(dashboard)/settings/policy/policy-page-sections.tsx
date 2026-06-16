import Link from "next/link";
import { Activity, ArrowUpRight, ChevronRight, FileCode2, Layers, Sparkles } from "lucide-react";
import type { WorkspacePolicy, WorkspacePolicyGroup } from "@/lib/workspace-policy-model";

function policyStatusClass(policy: WorkspacePolicy): string {
  if (policy.status === "warning") {
    return "border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface-raised))] text-[var(--warning-ink)]";
  }
  if (policy.status === "unavailable") {
    return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--surface-raised))] text-[var(--text-tertiary)]";
  }
  return "border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface-raised))] text-[var(--success-ink)]";
}

function PolicyGroupSection({ group }: { group: WorkspacePolicyGroup }) {
  return (
    <section className="ui-card overflow-hidden p-0">
      <header className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
        <h3 className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
          {group.title}
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {group.description}
        </p>
      </header>
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {group.policies.map((policy) => (
          <li
            key={policy.id}
            className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  {policy.title}
                </h4>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${policyStatusClass(policy)}`}
                >
                  {policy.status === "active"
                    ? "Active"
                    : policy.status === "warning"
                      ? "Warning"
                      : "Unavailable"}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{policy.affectsLabel}</p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">{policy.detail}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/settings/policy/registry" className="ui-btn-secondary px-3 py-1.5 text-xs">
                Edit advanced settings
              </Link>
              <Link
                href="/settings/policy/diagnostics"
                className="ui-btn-ghost px-3 py-1.5 text-xs"
              >
                View diagnostics
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PolicyGroups({ groups }: { groups: WorkspacePolicyGroup[] }) {
  if (groups.length === 0) {
    return (
      <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 sm:p-8">
        <div
          aria-hidden
          className="landing-corner-ring"
          style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
        />
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
            aria-hidden
          >
            <Layers className="h-5 w-5" strokeWidth={1.65} />
          </span>
          <div className="min-w-0 flex-1">
            <p>
              <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                No policies yet
              </span>
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
              Start with the structured policy registry
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Policies control approval timing, reminder cadence, evidence requirements, and review checkpoints.
              Configure them in the advanced editor when this workspace is ready for structured rules.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2">
              <Link
                href="/settings/policy/registry"
                className="ui-btn-primary min-h-10 px-4 py-2.5 text-[12.5px]"
              >
                Open advanced editor
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/settings/policy/diagnostics"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] hover:text-[var(--accent-strong)]"
              >
                Inspect diagnostics
                <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <PolicyGroupSection key={group.key} group={group} />
      ))}
    </div>
  );
}

export function AdvancedTools() {
  const tools = [
    {
      href: "/settings/policy/registry",
      title: "Advanced policy editor",
      description: "Edit the underlying policy list and save registry changes.",
      icon: FileCode2,
    },
    {
      href: "/settings/policy/diagnostics",
      title: "Policy diagnostics",
      description: "Inspect validation details, fallback behavior, and preview support.",
      icon: Activity,
    },
  ] as const;
  return (
    <section aria-labelledby="policy-administration">
      <header className="mb-3 flex items-center gap-2.5">
        <Sparkles className="h-3 w-3 text-[var(--text-tertiary)]" aria-hidden />
        <h2
          id="policy-administration"
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
        >
          Policy administration
        </h2>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {tools.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group ui-card relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]"
          >
            <div className="flex items-start gap-3.5">
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <Icon className="h-4 w-4" strokeWidth={1.85} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  {title}
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent-strong)]"
                    aria-hidden
                  />
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  {description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
