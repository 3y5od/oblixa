import {
  Bell,
  CalendarClock,
  CircleDot,
  FileText,
  ListChecks,
  Search,
  type LucideIcon,
} from "lucide-react";

const DETAIL_CONSEQUENCE: Record<string, string> = {
  "renewal date": "renewal reminders and reports",
  "notice date": "notice-deadline reminders",
  "notice deadline": "notice-deadline reminders",
  "notice window": "the calculated notice deadline",
  owner: "reminder routing, tasks, and reports",
  counterparty: "search, grouping, and reports",
  "effective date": "status and renewal timing",
  "start date": "status and renewal timing",
  "end date": "status and renewal timing",
  "termination date": "status and renewal timing",
  "expiration date": "status and renewal timing",
  "contract value": "inventory and prioritization reports",
  "payment terms": "contract tracking and reports",
};

type Outcome = { label: string; icon: LucideIcon };

const DETAIL_OUTCOMES: Record<string, Outcome[]> = {
  "renewal date": [
    { label: "Renewal reminders will send", icon: Bell },
    { label: "Renewal report will include it", icon: FileText },
  ],
  "notice date": [
    { label: "Notice reminders will send", icon: Bell },
    { label: "Notice tasks will be created", icon: ListChecks },
  ],
  "notice deadline": [
    { label: "Notice reminders will send", icon: Bell },
    { label: "Notice tasks will be created", icon: ListChecks },
  ],
  "notice window": [
    { label: "Notice deadline will be calculated", icon: CalendarClock },
    { label: "Notice reminders will send", icon: Bell },
  ],
  owner: [
    { label: "Tasks will route to the owner", icon: ListChecks },
    { label: "Reminders will reach the owner", icon: Bell },
    { label: "Owner will show in reports", icon: FileText },
  ],
  counterparty: [
    { label: "Search & grouping will use it", icon: Search },
    { label: "Reports will include it", icon: FileText },
  ],
  "effective date": [
    { label: "Contract status will use this date", icon: CircleDot },
    { label: "Renewal timing will be set", icon: CalendarClock },
    { label: "Reports will include the detail", icon: FileText },
  ],
  "start date": [
    { label: "Contract status will use this date", icon: CircleDot },
    { label: "Renewal timing will be set", icon: CalendarClock },
  ],
  "end date": [
    { label: "Contract status will use this date", icon: CircleDot },
    { label: "Renewal timing will be set", icon: CalendarClock },
  ],
  "termination date": [
    { label: "Contract status will use this date", icon: CircleDot },
    { label: "Renewal timing will be set", icon: CalendarClock },
  ],
  "expiration date": [
    { label: "Contract status will use this date", icon: CircleDot },
    { label: "Renewal timing will be set", icon: CalendarClock },
  ],
  "contract value": [
    { label: "Will count in inventory", icon: FileText },
    { label: "Will inform prioritization", icon: ListChecks },
  ],
  "payment terms": [
    { label: "Payment tracking will turn on", icon: CalendarClock },
    { label: "Reports will include it", icon: FileText },
  ],
};

export function detailConsequence(label: string | undefined): string | null {
  if (!label) return null;
  return DETAIL_CONSEQUENCE[label.trim().toLowerCase()] ?? null;
}

export function detailOutcomes(label: string): Outcome[] {
  return (
    DETAIL_OUTCOMES[label.trim().toLowerCase()] ?? [
      { label: "Reminders will activate", icon: Bell },
      { label: "Tasks will route to owners", icon: ListChecks },
      { label: "Reports will update", icon: FileText },
    ]
  );
}
