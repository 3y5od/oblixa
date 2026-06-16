import { RefreshCw, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";
import type { SemanticStatus } from "@/components/ui/status-badge";
import {
  statusLabel,
  statusTone,
  type WorkspaceHealthItem,
  type WorkspaceHealthStatus,
} from "@/lib/workspace-health-model";

export type HealthTone = "neutral" | "attention" | "risk" | "healthy";

export function healthItemTone(item: WorkspaceHealthItem): HealthTone {
  const tone = statusTone(item.status);
  return tone === "healthy" ? "healthy" : tone;
}

export function workspaceStatusHeadline(item: WorkspaceHealthItem | null): string {
  if (!item) return "Workspace systems are clear";
  if (item.id === "automated-recovery" && item.status === "not_configured") {
    return "Recovery setup needed";
  }
  if (item.status === "blocked") return `${item.label} is blocked`;
  if (item.status === "delayed") return `${item.label} is delayed`;
  return `${item.label} needs attention`;
}

export function visibleStatusLabel(status: WorkspaceHealthStatus): string {
  if (status === "not_configured") return "Setup needed";
  return statusLabel(status);
}

export function heroNarrativeText(item: WorkspaceHealthItem | null, allClearSentence: string): string {
  if (!item) return allClearSentence;
  if (item.id === "automated-recovery" && item.status === "not_configured") {
    return "Recovery worker is not configured. Reminder and notification retries cannot be trusted.";
  }
  return item.userImpact ?? item.detail ?? `${item.label} needs attention.`;
}

export function workspaceSemanticStatus(status: WorkspaceHealthStatus): SemanticStatus {
  if (status === "healthy") return "healthy";
  if (status === "blocked" || status === "needs_attention") return "critical";
  if (status === "delayed" || status === "not_configured") return "warning";
  return "info";
}

export function heroMedallionClass(status: WorkspaceHealthStatus): string {
  const base =
    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[var(--shadow-1)]";
  if (status === "healthy") {
    return `${base} border-[color:color-mix(in_oklab,var(--success-soft)_42%,var(--border-subtle))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--success-soft)_88%,white)_0%,color-mix(in_oklab,var(--success-soft)_62%,white)_100%)] text-[var(--success-ink)]`;
  }
  if (status === "blocked" || status === "needs_attention") {
    return `${base} border-[color:color-mix(in_oklab,var(--danger-soft)_42%,var(--border-subtle))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--danger-soft)_88%,white)_0%,color-mix(in_oklab,var(--danger-soft)_62%,white)_100%)] text-[var(--danger-ink)]`;
  }
  if (status === "delayed" || status === "not_configured") {
    return `${base} border-[color:color-mix(in_oklab,var(--warning-soft)_42%,var(--border-subtle))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--warning-soft)_88%,white)_0%,color-mix(in_oklab,var(--warning-soft)_62%,white)_100%)] text-[var(--warning-ink)]`;
  }
  return `${base} border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)]`;
}

export function workspaceAccentGradient(status: WorkspaceHealthStatus): string {
  if (status === "healthy") {
    return "linear-gradient(180deg, color-mix(in oklab, var(--success-ink) 80%, transparent) 0%, color-mix(in oklab, var(--success-ink) 20%, transparent) 100%)";
  }
  if (status === "blocked" || status === "needs_attention") {
    return "linear-gradient(180deg, color-mix(in oklab, var(--danger-ink) 80%, transparent) 0%, color-mix(in oklab, var(--danger-ink) 20%, transparent) 100%)";
  }
  if (status === "delayed" || status === "not_configured") {
    return "linear-gradient(180deg, color-mix(in oklab, var(--warning-ink) 80%, transparent) 0%, color-mix(in oklab, var(--warning-ink) 20%, transparent) 100%)";
  }
  return "linear-gradient(180deg, color-mix(in oklab, var(--border-contrast) 70%, transparent) 0%, color-mix(in oklab, var(--border-contrast) 20%, transparent) 100%)";
}

export function actionCountAccent(status: WorkspaceHealthStatus, affectedCount: number): {
  color: string;
  boxShadowColor: string;
} {
  if (affectedCount === 0) {
    return { color: "var(--success-ink)", boxShadowColor: "var(--success-soft)" };
  }
  if (status === "blocked" || status === "needs_attention") {
    return { color: "var(--danger-ink)", boxShadowColor: "var(--danger-soft)" };
  }
  return { color: "var(--warning-ink)", boxShadowColor: "var(--warning-soft)" };
}

export function HeroStatusIcon({ status }: { status: WorkspaceHealthStatus }) {
  const cls = "h-7 w-7";
  if (status === "healthy") return <ShieldCheck className={cls} strokeWidth={1.65} aria-hidden />;
  if (status === "blocked" || status === "needs_attention") {
    return <ShieldAlert className={cls} strokeWidth={1.65} aria-hidden />;
  }
  if (status === "delayed" || status === "not_configured") {
    return <Wrench className={cls} strokeWidth={1.65} aria-hidden />;
  }
  return <RefreshCw className={cls} strokeWidth={1.65} aria-hidden />;
}
