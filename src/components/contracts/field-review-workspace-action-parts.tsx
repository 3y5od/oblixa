import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export function ActionAlert({ tone, children }: { tone: "warning" | "danger"; children: ReactNode }) {
  const ink = tone === "danger" ? "var(--danger-ink)" : "var(--warning-ink)";
  const accent = tone === "danger" ? "var(--danger)" : "var(--warning)";
  const soft = tone === "danger" ? "var(--danger-soft)" : "var(--warning-soft)";
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 30%, var(--border-subtle))`,
        background: `color-mix(in oklab, ${soft} 26%, var(--surface))`,
      }}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden style={{ color: ink }} />
      <p className="text-[12px] font-medium leading-snug" style={{ color: ink }}>
        {children}
      </p>
    </div>
  );
}

export function isoDateSeed(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1] : null;
}
