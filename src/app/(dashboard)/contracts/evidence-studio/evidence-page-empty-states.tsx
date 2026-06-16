import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { EmptyState } from "@/components/ui/empty-state";
import type { EvidenceSectionKey, EvidenceSectionSummary } from "@/lib/evidence/types";

const SHORT_SECTION_LABELS: Record<EvidenceSectionKey, string> = {
  open_requests: "Open",
  overdue_requests: "Overdue",
  received_evidence: "Received",
  linked_obligations: "Linked",
};

export function SectionEmptyState({
  sections,
  activeSection,
  createHref,
}: {
  sections: EvidenceSectionSummary[];
  activeSection: EvidenceSectionKey;
  createHref: string;
}) {
  const active = sections.find((section) => section.key === activeSection);
  const elsewhere = sections.filter((section) => section.key !== activeSection && section.count > 0);
  return (
    <div className="px-5 py-12">
      <EmptyState
        size="compact"
        icon={<Inbox className="h-5 w-5 text-[var(--text-tertiary)]" strokeWidth={1.65} aria-hidden />}
        eyebrow="Evidence requests"
        title={`Nothing in ${(active?.label ?? "this view").toLowerCase()}`}
        copy="Evidence work needs attention in another view - jump to it below."
        action={
          <>
            {elsewhere.map((section) => (
              <ChipCapsule
                key={section.key}
                href={section.href}
                leftValue={section.count}
                leftLabel={SHORT_SECTION_LABELS[section.key]}
                rightVerb="View"
                tone={section.key === "overdue_requests" ? "danger" : undefined}
              />
            ))}
            <Link href={createHref} className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px]">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Request evidence
            </Link>
          </>
        }
      />
    </div>
  );
}

export function FilteredEmptyState({ clearHref }: { clearHref: string }) {
  return (
    <div className="px-5 py-12">
      <EmptyState
        size="compact"
        icon={<Inbox className="h-5 w-5 text-[var(--text-tertiary)]" strokeWidth={1.65} aria-hidden />}
        eyebrow="Evidence requests"
        title="No requests match these filters"
        copy="Adjust or clear the filters to see more evidence requests."
        action={
          <Link href={clearHref} className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12.5px]">
            Clear filters
          </Link>
        }
      />
    </div>
  );
}
