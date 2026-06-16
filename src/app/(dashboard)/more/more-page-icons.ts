import {
  BadgeCheck,
  BarChart3,
  BellRing,
  Boxes,
  CalendarClock,
  CreditCard,
  FileCheck2,
  Files,
  Gavel,
  GitBranch,
  Grid2x2,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  ListTodo,
  Megaphone,
  SearchCheck,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Stamp,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/navigation";
import type { WorkflowDestinationKey } from "@/lib/product-surface/workflow-destinations";

const JUMP_LINK_ICONS: Partial<Record<WorkflowDestinationKey, LucideIcon>> = {
  programs: LayoutGrid,
  relationships: GitBranch,
  advanced_analytics: BarChart3,
  maintenance: Wrench,
  system_health: HeartPulse,
  assurance: Shield,
  program_evolution: Sparkles,
  control_policies: ShieldCheck,
  outcome_intelligence: TrendingUp,
  assurance_analytics: BarChart3,
};

const NAV_ICON_BY_KEY: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  review: SearchCheck,
  contracts: Files,
  tasks: ListTodo,
  renewals: CalendarClock,
  exceptions: BellRing,
  evidence: FileCheck2,
  reports: BarChart3,
  decisions: BadgeCheck,
  campaigns: Megaphone,
  assurance: Shield,
  relationships: GitBranch,
  programs: Boxes,
  settings: Settings,
  billing: CreditCard,
  more: Grid2x2,
};

const NAV_ICON_BY_HREF: Record<string, LucideIcon> = {
  "/work": ListTodo,
  "/contracts/approvals": Stamp,
  "/contracts/obligations": ListChecks,
  "/contracts/tasks": ListTodo,
  "/renewals": CalendarClock,
  "/contracts/renewals": CalendarClock,
  "/contracts/exceptions": BellRing,
  "/evidence": FileCheck2,
  "/contracts/evidence-studio": FileCheck2,
  "/settings/health": HeartPulse,
  "/settings/policy": Gavel,
  "/settings/security": ShieldCheck,
};

export function iconForJumpLink(key: WorkflowDestinationKey): LucideIcon {
  return JUMP_LINK_ICONS[key] ?? Settings;
}

export function iconForNavItem(item: NavItem): LucideIcon {
  const byHref = NAV_ICON_BY_HREF[item.href];
  if (byHref) return byHref;
  if (item.icon && NAV_ICON_BY_KEY[item.icon]) return NAV_ICON_BY_KEY[item.icon];
  return Boxes;
}
