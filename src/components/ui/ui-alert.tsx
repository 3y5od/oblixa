import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { StatTone } from "@/components/ui/stat-cell";

export interface UiAlertProps {
  tone: StatTone;
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

function defaultIcon(tone: StatTone): ReactNode {
  if (tone === "success") return <CheckCircle2 className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
  if (tone === "warning") return <TriangleAlert className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
  if (tone === "danger") return <AlertCircle className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
  return <Info className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
}

function toneStyles(tone: StatTone): { border: string; bg: string; ink: string } {
  if (tone === "success")
    return {
      border: "color-mix(in oklab, var(--success-ink) 30%, var(--border-subtle))",
      bg: "color-mix(in oklab, var(--success-soft) 30%, var(--surface-raised))",
      ink: "var(--success-ink)",
    };
  if (tone === "warning")
    return {
      border: "color-mix(in oklab, var(--warning-ink) 30%, var(--border-subtle))",
      bg: "color-mix(in oklab, var(--warning-soft) 30%, var(--surface-raised))",
      ink: "var(--warning-ink)",
    };
  if (tone === "danger")
    return {
      border: "color-mix(in oklab, var(--danger-ink) 30%, var(--border-subtle))",
      bg: "color-mix(in oklab, var(--danger-soft) 30%, var(--surface-raised))",
      ink: "var(--danger-ink)",
    };
  return {
    border: "var(--border-subtle)",
    bg: "color-mix(in oklab, var(--surface-muted) 60%, var(--surface-raised))",
    ink: "var(--text-secondary)",
  };
}

export function UiAlert({ tone, title, children, icon, actions, className }: UiAlertProps) {
  const styles = toneStyles(tone);
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${className ?? ""}`}
      style={{
        borderColor: styles.border,
        background: styles.bg,
      }}
    >
      <span className="inline-flex shrink-0 pt-0.5" style={{ color: styles.ink }}>
        {icon ?? defaultIcon(tone)}
      </span>
      <div className="min-w-0 flex-1">
        {title ? (
          <p
            className="text-[12.5px] font-semibold tracking-tight"
            style={{ color: styles.ink }}
          >
            {title}
          </p>
        ) : null}
        <div
          className={`text-[12.5px] leading-relaxed text-[var(--text-secondary)] ${
            title ? "mt-1" : ""
          }`}
        >
          {children}
        </div>
        {actions ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
