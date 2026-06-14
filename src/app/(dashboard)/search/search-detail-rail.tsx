import { createElement, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy } from "lucide-react";
import { SEARCH_GROUP_LABELS, resolveSearchGroupForNavItem, type WorkspaceRole } from "@/lib/navigation";
import type { PaletteItem } from "@/components/layout/command-palette-helpers";
import { resolveRowActionVerb } from "@/components/search/result-row";
import { resolveNavIcon } from "@/components/search/nav-icon";

/** Desktop-only detail rail mirroring the active result. Sticky so it stays in
 *  view as the page scrolls; hidden below lg where the page is single-column. */
export function SearchDetailRail({
  item,
  role,
  onSelect,
}: {
  item: PaletteItem | null;
  role: WorkspaceRole;
  onSelect: (href: string) => void;
}) {
  const verb = item ? resolveRowActionVerb(item, role) : "OPEN";
  const group = item
    ? SEARCH_GROUP_LABELS[item.searchGroup ?? resolveSearchGroupForNavItem(item)]
    : "";
  return (
    <aside className="hidden self-start rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)] lg:sticky lg:top-[calc(var(--shell-topbar-h)+1rem)] lg:flex lg:flex-col">
      {item ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Selected destination
          </p>
          <span
            aria-hidden
            className="mt-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
          >
            {createElement(resolveNavIcon(item), { className: "h-[1.125rem] w-[1.125rem]", strokeWidth: 1.85 })}
          </span>
          <p className="mt-3 text-[15px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
            {item.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              {group}
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
              {verb}
            </span>
          </div>
          {item.description ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
          ) : null}
          <CopyPathRow href={item.href} />
          <Link
            href={item.href}
            onClick={() => onSelect(item.href)}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_35%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_28%,var(--surface-raised))] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_48%,var(--surface-raised))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
          >
            {verb}
            <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </>
      ) : (
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Keyboard</p>
          <div className="mt-2.5 flex flex-col gap-2 text-[11px] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">↑↓</kbd> Move</span>
            <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">Enter</kbd> Open</span>
            <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">/</kbd> Focus</span>
          </div>
        </div>
      )}
    </aside>
  );
}

/** Mono path + copy-to-clipboard affordance for the detail rail. Copy gives a
 *  brief check-mark confirmation, then reverts. Clipboard write is best-effort
 *  (guarded for browsers/contexts where `navigator.clipboard` is unavailable). */
function CopyPathRow({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending revert timer on unmount (no state set in the effect body,
  // only in the click handler / timer callback — satisfies set-state-in-effect).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    try {
      const result = navigator.clipboard?.writeText(href);
      if (result) void result.catch(() => undefined);
    } catch {
      // ignore — clipboard may be blocked by permissions/context
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  }, [href]);

  return (
    <div className="mt-3 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--text-tertiary)]">{href}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Path copied" : "Copy path"}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
      >
        {copied ? (
          <Check className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={2.4} aria-hidden />
        ) : (
          <Copy className="h-3 w-3" strokeWidth={2} aria-hidden />
        )}
      </button>
    </div>
  );
}
