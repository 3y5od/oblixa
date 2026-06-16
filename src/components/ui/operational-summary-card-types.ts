import type { ComponentType, ReactNode } from "react";
import type { OperationalTone } from "@/lib/ui/operational-surface";

export type OperationalBreakdownItem = { label: string; value: string };

export type OperationalTriageItem = {
  id: string;
  title: string;
  description?: string;
  count?: number | string;
  tone?: OperationalTone;
  href?: string;
  actionLabel?: string;
  meta?: OperationalBreakdownItem[];
};

export type IconProps = {
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
};

export type OperationalSummaryCardProps = {
  eyebrow: string;
  headline: string;
  tone: OperationalTone;
  icon: ComponentType<IconProps>;
  primaryValue: number | string | null;
  primaryFallback?: string;
  primaryUnit?: string;
  secondaryLine?: string;
  breakdown?: OperationalBreakdownItem[];
  action: { href: string; label: string; external?: boolean };
  variant?: "default" | "compact" | "hero";
  showStatusBadge?: boolean;
  className?: string;
  footerExtra?: ReactNode;
  id?: string;
};

export type OperationalSurfaceLinkCardProps = {
  href: string;
  eyebrow: string;
  title: string;
  tone?: OperationalTone;
  icon: ComponentType<IconProps>;
  chips?: OperationalBreakdownItem[];
  actionLabel?: string;
  hint?: string;
  variant?: "default" | "hero";
  className?: string;
};
