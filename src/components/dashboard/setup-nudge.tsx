import Link from "next/link";
import { ArrowRight, Check, Layers, Settings2, Sparkles, UploadCloud } from "lucide-react";

interface SetupNudgeProps {
  contractCount: number;
  hasIntegrations?: boolean;
  hasCustomFields?: boolean;
}

const TILES = [
  {
    id: "upload",
    icon: UploadCloud,
    title: "Upload your first contract",
    href: "/contracts/new",
  },
  {
    id: "bulk",
    icon: Layers,
    title: "Bulk import",
    href: "/contracts/bulk",
  },
  {
    id: "configure",
    icon: Settings2,
    title: "Configure workspace",
    href: "/settings",
  },
];

export function SetupNudge({
  contractCount,
  hasIntegrations,
  hasCustomFields,
}: SetupNudgeProps) {
  // Only render for fresh / sparse workspaces. Once you have ≥ 3 contracts the
  // dashboard already has enough density to stand on its own.
  if (contractCount >= 3) return null;

  const completed = TILES.filter((tile) => {
    if (tile.id === "upload") return contractCount > 0;
    if (tile.id === "bulk") return contractCount >= 3;
    if (tile.id === "configure") return hasIntegrations || hasCustomFields;
    return false;
  }).length;
  const progressPct = Math.round((completed / TILES.length) * 100);

  const TITLES: Record<string, string> = {
    upload: "UPLOAD CONTRACT",
    bulk: "BULK IMPORT",
    configure: "CONFIGURE",
  };

  return (
    <section
      aria-label="Get started"
      className="rounded-2xl border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,var(--surface-raised))] px-3 py-2.5"
    >
      <header className="flex items-center gap-2.5">
        <Sparkles
          className="h-4 w-4 shrink-0 text-[var(--accent-strong)]"
          strokeWidth={1.85}
          aria-hidden
        />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          SETUP
        </span>
        <div className="flex h-2 w-40 items-center overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] sm:w-56">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-strong)_0%,var(--accent)_100%)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent-strong)_18%,transparent)] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-card))] bg-[var(--surface-raised)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none tabular-nums text-[var(--accent-strong)]">
          <span>{completed}</span>
          <span className="text-[var(--text-tertiary)]" aria-hidden>/</span>
          <span className="text-[var(--text-tertiary)]">{TILES.length}</span>
        </span>
      </header>
      <ol className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TILES.map((tile, index) => {
          const Icon = tile.icon;
          const isComplete =
            (tile.id === "upload" && contractCount > 0) ||
            (tile.id === "bulk" && contractCount >= 3) ||
            (tile.id === "configure" && (hasIntegrations || hasCustomFields));
          /* Single-glyph rule: complete → Check; pending → step icon. Never both. */
          const StepIcon = isComplete ? Check : Icon;
          const statusChip = isComplete ? "DONE" : index === completed ? "NEXT" : "—";
          const statusInk = isComplete
            ? "var(--success-ink)"
            : index === completed
              ? "var(--accent-strong)"
              : "var(--text-tertiary)";
          return (
            <li key={tile.id}>
              <Link
                href={tile.href}
                className={`group grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors ${
                  isComplete
                    ? "border-[color:color-mix(in_oklab,var(--success-soft)_50%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--success-soft)_16%,var(--surface-raised))] hover:border-[color:color-mix(in_oklab,var(--success-ink)_42%,var(--border-strong))]"
                    : "border-[var(--border-card)] bg-[var(--surface-raised)] hover:border-[color:color-mix(in_oklab,var(--accent)_36%,var(--border-strong))]"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                    isComplete
                      ? "bg-[color:color-mix(in_oklab,var(--success-soft)_60%,var(--surface-raised))] text-[var(--success-ink)]"
                      : "bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--surface-raised))] text-[var(--accent-strong)]"
                  }`}
                >
                  <StepIcon className="h-3 w-3" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 leading-none">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
                      STEP {index + 1}
                    </span>
                    <span
                      className="inline-flex items-center rounded-md px-1 py-0 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none"
                      style={{
                        color: statusInk,
                        border:
                          statusChip === "—"
                            ? "1px solid color-mix(in oklab, var(--text-tertiary) 30%, transparent)"
                            : "none",
                        background:
                          statusChip === "—"
                            ? "transparent"
                            : `color-mix(in oklab, ${statusInk} 12%, var(--surface-raised))`,
                        height: "16px",
                      }}
                    >
                      {statusChip}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[11px] uppercase tracking-[0.14em] leading-tight ${
                      isComplete ? "font-semibold" : "font-bold"
                    }`}
                    style={{
                      color: isComplete
                        ? "var(--text-secondary)"
                        : "var(--text-primary)",
                    }}
                    title={tile.title}
                  >
                    {TITLES[tile.id] ?? tile.title.toUpperCase()}
                  </span>
                </span>
                {!isComplete ? (
                  <ArrowRight
                    className={`mb-0.5 h-3 w-3 shrink-0 self-end text-[var(--accent-strong)] transition-opacity group-hover:opacity-100 ${index === completed ? "opacity-90" : "opacity-70"}`}
                    strokeWidth={1.85}
                    aria-hidden
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
