export type DiagnosticTone = "neutral" | "healthy" | "attention" | "risk";

function supportCellClass(tone: DiagnosticTone): string {
  const base =
    "rounded-lg border border-l-[0.2rem] bg-[color:color-mix(in_oklab,var(--surface)_94%,white)] px-3 py-2";
  if (tone === "healthy") return `${base} border-[color:var(--border-card)] border-l-[color:var(--success-ink)]`;
  if (tone === "attention") return `${base} border-[color:var(--border-card)] border-l-[color:var(--warning-ink)]`;
  if (tone === "risk") return `${base} border-[color:var(--border-card)] border-l-[color:var(--danger-ink)]`;
  return `${base} border-[color:var(--border-card)] border-l-[color:var(--border-contrast)]`;
}

function supportDotClass(tone: DiagnosticTone): string {
  if (tone === "healthy") return "text-[var(--success-ink)]";
  if (tone === "attention") return "text-[var(--warning-ink)]";
  if (tone === "risk") return "text-[var(--danger-ink)]";
  return "text-[var(--text-tertiary)]";
}

function supportMeterClass(tone: DiagnosticTone): string {
  if (tone === "healthy") return "bg-[var(--success-ink)]";
  if (tone === "attention") return "bg-[var(--warning-ink)]";
  if (tone === "risk") return "bg-[var(--danger-ink)]";
  return "bg-[var(--border-contrast)]";
}

function SupportSampleTrack({
  value,
  label,
  tone,
}: {
  value: number | null;
  label: string;
  tone: DiagnosticTone;
}) {
  const width = value == null ? 0 : Math.max(4, Math.min(100, Math.round(value)));
  return (
    <div className="mt-3">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_64%,transparent)]"
        aria-label={label}
        role="img"
      >
        {width > 0 ? (
          <span className={`block h-full rounded-full ${supportMeterClass(tone)}`} style={{ width: `${width}%` }} />
        ) : null}
      </div>
      <p className="mt-1 text-[11px] font-medium text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}

export function SupportDiagnosticCell({
  label,
  value,
  detail,
  tone,
  meter,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: DiagnosticTone;
  meter?: {
    value: number | null;
    label: string;
  };
}) {
  return (
    <article className={supportCellClass(tone)}>
      <div className="flex items-center gap-2">
        <span className={`text-xs leading-none ${supportDotClass(tone)}`} aria-hidden>
          ●
        </span>
        <p className="ui-kicker">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p> : null}
      {meter ? <SupportSampleTrack value={meter.value} label={meter.label} tone={tone} /> : null}
    </article>
  );
}
