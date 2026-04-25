import { Bell, ClipboardPen, FileText, ListTree } from "lucide-react";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

export function ContractHeroMetrics(props: {
  contractId: string;
  pendingFieldsCount: number;
  fieldsCount: number;
  filesCount: number;
  upcomingRemindersCount: number;
}) {
  const base = `/contracts/${props.contractId}`;
  return (
    <div className="mt-6 grid gap-3 border-t border-[var(--border-subtle)] pt-6 sm:mt-8 sm:grid-cols-2 sm:pt-8 lg:grid-cols-4">
      <OperationalSummaryCard
        eyebrow="Review"
        headline="Pending fields"
        tone={props.pendingFieldsCount > 0 ? "attention" : "healthy"}
        icon={ClipboardPen}
        primaryValue={props.pendingFieldsCount}
        primaryUnit="awaiting approval"
        action={{ href: `${base}#extracted-fields`, label: "Review fields" }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="Coverage"
        headline="Fields tracked"
        tone="neutral"
        icon={ListTree}
        primaryValue={props.fieldsCount}
        primaryUnit="extracted rows"
        action={{ href: `${base}#extracted-fields`, label: "Open fields" }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="Library"
        headline="Documents"
        tone={props.filesCount > 0 ? "neutral" : "attention"}
        icon={FileText}
        primaryValue={props.filesCount}
        primaryUnit="files on record"
        action={{ href: `${base}?tab=overview`, label: "Manage files" }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="Schedule"
        headline="Upcoming reminders"
        tone={props.upcomingRemindersCount > 0 ? "attention" : "healthy"}
        icon={Bell}
        primaryValue={props.upcomingRemindersCount}
        primaryUnit="not yet sent"
        action={{ href: `${base}?tab=dates`, label: "View dates" }}
        variant="compact"
      />
    </div>
  );
}
