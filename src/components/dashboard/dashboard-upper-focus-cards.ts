import type { ComponentType, CSSProperties } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FolderClock,
  History,
  ShieldAlert,
  Slash,
  UserX,
} from "lucide-react";
import { DUE_SOON_DAYS } from "@/lib/business-dates";
import { buildContractsListHref } from "@/lib/contracts-search-url";
import type { OperationalTone } from "@/lib/ui/operational-surface";

type DashboardIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
  style?: CSSProperties;
}>;

type DashboardMetrics = {
  totalContracts: number;
  pendingReview: number;
};

type DashboardSignals = {
  assignedWork: number;
  dueSoonAssignedWork: number;
  pendingApprovals: number;
  renewalAttention: number;
  openExceptions: number;
  outstandingEvidence: number;
  recentChanges: number;
  ownerAssignedContracts: number;
};

export type DashboardFocusCard = {
  id: string;
  title: string;
  href: string;
  why: string;
  count: number;
  icon: DashboardIcon;
  tone: OperationalTone;
  actionLabel: string;
  priority: number;
};

export type DashboardPinnedCommandView = {
  id: string;
  name: string;
  href: string;
  viewType: string;
};

type PinnedSavedView = {
  id: string;
  name: string;
  view_type: string;
  query_json: Record<string, unknown> | null;
  pinned: boolean;
};

export function buildDashboardUpperCommandViewLinks({
  pinnedSavedViews,
  isHrefEligible,
}: {
  pinnedSavedViews: unknown;
  isHrefEligible: (href: string) => boolean;
}): DashboardPinnedCommandView[] {
  return (pinnedSavedViews as PinnedSavedView[])
    .map((v) => {
      const query = new URLSearchParams();
      const q = v.query_json ?? {};
      for (const [k, val] of Object.entries(q)) {
        if (val == null) continue;
        query.set(k, String(val));
      }
      const base =
        v.view_type === "tasks"
          ? "/contracts/tasks"
          : v.view_type === "obligations"
            ? "/contracts/obligations"
            : v.view_type === "renewals"
              ? "/renewals"
              : "/contracts";
      const href =
        base === "/contracts"
          ? buildContractsListHref(Object.fromEntries(query.entries()) as Record<string, string>)
          : query.toString()
            ? `${base}?${query.toString()}`
            : base;
      return { id: v.id, name: v.name, href, viewType: v.view_type };
    })
    .filter((row) => isHrefEligible(row.href));
}

export function buildDashboardUpperFocusCards({
  metrics,
  operationalSignals,
  isHrefEligible,
}: {
  metrics: DashboardMetrics;
  operationalSignals: DashboardSignals;
  isHrefEligible: (href: string) => boolean;
}): DashboardFocusCard[] {
  const allFocusCards: DashboardFocusCard[] = [
    {
      id: "assigned-work",
      title: "Assigned tasks",
      href: "/work?lens=assigned",
      why: "Tasks, approvals, and contract requirements already routed to you.",
      count: operationalSignals.assignedWork,
      icon: ClipboardList,
      tone: operationalSignals.assignedWork > 0 ? "attention" : "healthy",
      actionLabel: "Open tasks",
      priority: 4,
    },
    {
      id: "due-soon",
      title: "Upcoming contract dates",
      href: "/work?lens=due_soon",
      why: `Items in the next ${DUE_SOON_DAYS} days that need attention before they slip.`,
      count: operationalSignals.dueSoonAssignedWork,
      icon: CalendarClock,
      tone: operationalSignals.dueSoonAssignedWork > 0 ? "risk" : "healthy",
      actionLabel: "Open deadlines",
      priority: 1,
    },
    {
      id: "approvals",
      title: "Pending approvals",
      href: "/contracts/approvals?status=pending",
      why: "Sign-off bottlenecks that hold reminders, tasks, or renewal decisions.",
      count: operationalSignals.pendingApprovals,
      icon: BadgeCheck,
      tone: operationalSignals.pendingApprovals > 0 ? "attention" : "healthy",
      actionLabel: "Review approvals",
      priority: 3,
    },
    {
      id: "renewals",
      title: "Renewals needing attention",
      href: "/renewals?window=90",
      why: "Contracts with renewal dates inside the active window.",
      count: operationalSignals.renewalAttention,
      icon: FolderClock,
      tone: operationalSignals.renewalAttention > 0 ? "attention" : "healthy",
      actionLabel: "Open renewals",
      priority: 5,
    },
    {
      id: "exceptions",
      title: "Open problems",
      href: "/contracts/exceptions?status=open",
      why: "Risk and issue records that still need an owner or resolution path.",
      count: operationalSignals.openExceptions,
      icon: AlertTriangle,
      tone: operationalSignals.openExceptions > 0 ? "risk" : "healthy",
      actionLabel: "Open",
      priority: 2,
    },
    {
      id: "evidence",
      title: "Open evidence requests",
      href: "/contracts?evidence=outstanding",
      why: "Outstanding evidence still holding back obligated work.",
      count: operationalSignals.outstandingEvidence,
      icon: ShieldAlert,
      tone: operationalSignals.outstandingEvidence > 0 ? "attention" : "healthy",
      actionLabel: "Open evidence",
      priority: 6,
    },
    {
      id: "review",
      title: "Contracts to review",
      href: "/contracts/review",
      why: "Contract-detail confirmation still pending before the workspace can trust suggested values.",
      count: metrics.pendingReview,
      icon: ClipboardCheck,
      tone: metrics.pendingReview > 0 ? "attention" : "healthy",
      actionLabel: "Confirm details",
      priority: 3,
    },
    {
      id: "recent",
      title: "Recent changes",
      href: "/contracts?sort=activity",
      why: "Freshly touched contracts and workflow changes from the last 7 days.",
      count: operationalSignals.recentChanges,
      icon: History,
      tone: operationalSignals.recentChanges > 0 ? "neutral" : "healthy",
      actionLabel: "See activity",
      priority: 7,
    },
    {
      id: "missing-owners",
      title: "Unassigned contracts",
      href: "/contracts",
      why: "Contracts without an assigned owner cannot route tasks or reminders.",
      count: Math.max(0, metrics.totalContracts - operationalSignals.ownerAssignedContracts),
      icon: UserX,
      tone:
        metrics.totalContracts > 0 && metrics.totalContracts - operationalSignals.ownerAssignedContracts > 0
          ? "attention"
          : "healthy",
      actionLabel: "Assign owners",
      priority: 5,
    },
    {
      id: "blocked-work",
      title: "Tasks needing input",
      href: "/work",
      why: "Tasks that need a dependency, approval, or evidence response before they can move forward.",
      count: 0,
      icon: Slash,
      tone: "healthy",
      actionLabel: "Open tasks",
      priority: 4,
    },
  ];
  const focusCards = allFocusCards.filter((card) => isHrefEligible(card.href));

  return [...focusCards].sort((a, b) => {
    const activeDelta = Number(b.count > 0) - Number(a.count > 0);
    if (activeDelta !== 0) return activeDelta;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });
}
