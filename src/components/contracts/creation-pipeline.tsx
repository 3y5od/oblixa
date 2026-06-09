export interface CreationPipelineStep {
  label: string;
  /** Optional qualifier chip under the step label (vertical layout only). */
  chip?: string;
  /** Optional medallion tone. Defaults to the quiet accent medallion so steps
   *  never imply completion; pass a status tone only for genuine live state. */
  tone?: "accent" | "success" | "warning" | "danger";
}

export interface CreationPipelineProps {
  /** Caps eyebrow above the steps (e.g. "After upload", "What happens next"). */
  heading?: string;
  steps: ReadonlyArray<CreationPipelineStep>;
  /** "vertical" (default) is the connected-medallion rail. "compact" flows the
   *  steps horizontally — wrapping to ~2 rows — on lg+ and stacks on small, so a
   *  long pipeline doesn't push the rest of a panel down. */
  layout?: "vertical" | "compact";
  className?: string;
}

function medallionStyle(tone: CreationPipelineStep["tone"]) {
  if (!tone) {
    return {
      borderColor: "color-mix(in oklab, var(--accent) 18%, var(--border-subtle))",
      background: "color-mix(in oklab, var(--accent-soft) 20%, var(--surface-raised))",
      color: "var(--accent-strong)",
    };
  }
  const ink =
    tone === "success"
      ? "var(--success-ink)"
      : tone === "warning"
        ? "var(--warning-ink)"
        : tone === "danger"
          ? "var(--danger-ink)"
          : "var(--accent-strong)";
  return {
    borderColor: `color-mix(in oklab, ${ink} 22%, var(--border-subtle))`,
    background: `color-mix(in oklab, ${ink} 14%, var(--surface-raised))`,
    color: ink,
  };
}

const MEDALLION =
  "relative z-[1] inline-flex h-6 w-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full border font-mono text-[10.5px] font-semibold leading-none tabular-nums";

/**
 * One connected-medallion stepper for the contract intake surfaces (§11.26).
 * Quiet wayfinding, never an action list. Used by the single-upload rail
 * ("After upload", vertical with qualifier chips) and the bulk-import panels
 * ("What happens next", compact horizontal on wide screens).
 */
export function CreationPipeline({
  heading,
  steps,
  layout = "vertical",
  className,
}: CreationPipelineProps) {
  return (
    <div className={className}>
      {heading ? (
        <p className="ui-caps-2 text-[10.5px] text-[var(--text-secondary)]">{heading}</p>
      ) : null}
      {layout === "compact" ? (
        <ol
          className={`flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-2.5 ${heading ? "mt-2.5" : ""}`}
        >
          {steps.map((step, index) => (
            <li key={step.label} className="inline-flex items-center gap-2">
              <span aria-hidden className={MEDALLION} style={medallionStyle(step.tone)}>
                {index + 1}
              </span>
              <span className="text-[12.5px] leading-snug text-[var(--text-secondary)]">
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className={heading ? "mt-2.5" : ""}>
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            return (
              <li
                key={step.label}
                className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 pb-3 last:pb-0"
              >
                {!last ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-3 top-6 w-px -translate-x-1/2 bg-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)]"
                  />
                ) : null}
                <span aria-hidden className={MEDALLION} style={medallionStyle(step.tone)}>
                  {index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[12.5px] leading-snug text-[var(--text-secondary)]">
                    {step.label}
                  </p>
                  {step.chip ? (
                    <span className="ui-caps-3 mt-1 inline-flex rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9.5px] leading-none text-[var(--text-tertiary)]">
                      {step.chip}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
