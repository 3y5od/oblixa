import Link from "next/link";
import { UiSelect } from "@/components/ui/ui-select";
import {
  CompressedNormalState,
  OperationalQueueRow,
  OperationalSummaryCard,
  SeverityMetricStrip,
} from "@/components/ui/operational-summary-card";
import {
  ALL_CLEAR_ACTION_LABELS,
  PERSONA_PRESETS,
  PERSONAS,
  rowTone,
  type PersonaId,
} from "@/app/(dashboard)/dashboard/persona/persona-dashboard-config";
import type { PersonaDashboardModel } from "@/app/(dashboard)/dashboard/persona/persona-dashboard-model";

export function PersonaDashboardDisabledState() {
  return (
    <div className="ui-card-hero px-6 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Feature flag</p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">Persona dashboard is disabled</h1>
      <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        This surface is off when <code className="text-xs">ENABLE_PERSONA_DASHBOARDS</code> is set to false, 0, no, or
        off on the server. Unset it to restore the default (on).
      </p>
      <div className="mt-5">
        <Link href="/dashboard" className="ui-btn-secondary px-4 py-2 text-[12.5px]">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export function PersonaDashboardView({
  persona,
  model,
}: {
  persona: PersonaId;
  model: PersonaDashboardModel;
}) {
  return (
    <div className="ui-page-stack gap-3">
      <PersonaHeader persona={persona} model={model} />
      <WorkViewsNav persona={persona} />
      <PersonaQueueSection model={model} />
      {model.personaMetrics.length > 0 ? <PersonaMetricsSection model={model} /> : null}
    </div>
  );
}

function PersonaHeader({ persona, model }: { persona: PersonaId; model: PersonaDashboardModel }) {
  return (
    <header className="ui-page-shell px-4 py-3.5 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="ui-eyebrow">Persona</p>
          <h1 className="ui-section-title mt-1 text-2xl sm:text-3xl">{model.config.label}</h1>
          <p className="ui-muted-tight mt-1.5 max-w-2xl text-sm">{model.config.purpose}</p>
          <Link className="ui-link mt-2 inline-flex text-xs" href="/dashboard">
            Back to default dashboard
          </Link>
        </div>
        <form action="/dashboard/persona" method="get" className="ui-toolbar items-end gap-2">
          <div className="min-w-0">
            <label htmlFor="persona" className="ui-label-caps">
              Persona
            </label>
            <UiSelect
              id="persona"
              name="persona"
              defaultValue={persona}
              options={PERSONAS.map((p) => ({ value: p.id, label: p.label }))}
              variant="compact"
              portal
              searchThreshold={8}
              className="min-w-[14rem] max-w-full"
              buttonClassName="w-full !min-h-11"
            />
          </div>
          <button type="submit" className="ui-btn-secondary px-4 py-2.5 text-[12.5px]">
            Apply persona
          </button>
        </form>
      </div>
    </header>
  );
}

function WorkViewsNav({ persona }: { persona: PersonaId }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <h2 className="ui-section-title text-base" style={{ color: "var(--text-primary)" }}>
            Work views
          </h2>
        </div>
        <nav aria-label="Work views" className="flex min-w-0 flex-wrap gap-2">
          {PERSONA_PRESETS.map((preset) => {
            const active = preset.persona === persona;
            return (
              <Link
                key={preset.id}
                href={preset.href}
                aria-current={active ? "page" : undefined}
                style={
                  active
                    ? {
                        backgroundColor: "var(--text-primary)",
                        borderColor: "var(--text-primary)",
                        color: "var(--surface)",
                      }
                    : { color: "var(--text-primary)" }
                }
                className={`ui-operational-focusable rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  active
                    ? "shadow-[var(--shadow-1)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)]"
                }`}
              >
                {preset.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

function PersonaQueueSection({ model }: { model: PersonaDashboardModel }) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="ui-eyebrow">Task queue</p>
            <h2 className="ui-section-title mt-1 text-xl">{model.config.queueTitle}</h2>
            <p className="ui-muted-tight mt-1 text-[12.5px]">{model.config.queueDescription}</p>
          </div>
          {model.actionableChips.length > 0 ? (
            <SeverityMetricStrip
              items={model.actionableChips.map((chip) => ({ ...chip, value: String(chip.value) }))}
            />
          ) : null}
        </div>
      </div>
      <div className="p-3">
        {model.showAllClear ? (
          <CompressedNormalState
            title={model.config.emptyMessage}
            description="Switch work views to inspect another queue."
            action={
              model.secondaryNavAction
                ? {
                    href: model.secondaryNavAction.href,
                    label: ALL_CLEAR_ACTION_LABELS[model.secondaryNavAction.id],
                  }
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {model.personaQueue.map((row) => {
              const metadata = [row.contractTitle, row.ownerLabel, row.dueLabel].filter(Boolean).join(" · ");
              return (
                <li key={row.id} className="py-2">
                  <OperationalQueueRow
                    href={row.href}
                    eyebrow={row.reason}
                    title={row.title}
                    hint={metadata}
                    actionLabel={row.actionLabel}
                    tone={rowTone(row.urgency)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function PersonaMetricsSection({ model }: { model: PersonaDashboardModel }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="ui-eyebrow">Summary</p>
        <h2 className="ui-section-title mt-1 text-lg">Advanced portfolio summary</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {model.personaMetrics.map((m) => (
          <OperationalSummaryCard
            key={m.key}
            eyebrow={m.eyebrow}
            headline={m.headline}
            tone={m.tone}
            icon={m.icon}
            primaryValue={m.primaryValue}
            primaryUnit={m.primaryUnit}
            breakdown={m.breakdown ?? []}
            action={m.action}
            variant="compact"
          />
        ))}
      </div>
    </section>
  );
}
