import { format } from "date-fns";
import { REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY } from "@/lib/reminder-delivery-visibility";

export type ContractDetailAccent = "primary" | "attention" | "secondary";
export type ContractDetailIconKey = "owner" | "nextAction" | "reminders" | "freshness";

export type ContractDetailOperationStripItem = {
  label: string;
  value: string;
  accent: ContractDetailAccent;
  icon: ContractDetailIconKey;
  footerHref?: string;
  footerLabel?: string;
};

export type ContractDetailImmediateAction = {
  href: string;
  eyebrow: string;
  title: string;
  hint: string;
  actionLabel: string;
  tone: "neutral" | "attention" | "risk";
};

export function buildContractOperationsStrip(input: {
  ownerLabel: string | null;
  requiredNextStep: string | null;
  upcomingRemindersCount: number;
  reminderHistoryCount: number;
  approvedFieldsCount: number;
  latestExtractionTouchAt: string | null;
  latestSourceDocumentAt: string | null;
}): ContractDetailOperationStripItem[] {
  const reminderValue =
    input.upcomingRemindersCount > 0
      ? `${input.upcomingRemindersCount} scheduled`
      : input.reminderHistoryCount > 0
        ? "Previously sent"
        : input.approvedFieldsCount > 0
          ? "No reminder schedule yet"
          : REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY;

  const reminderAccent: ContractDetailAccent =
    input.upcomingRemindersCount > 0
      ? "primary"
      : input.approvedFieldsCount > 0
        ? "attention"
        : "secondary";

  const freshnessValue = input.latestExtractionTouchAt
    ? `Suggestions updated ${format(new Date(input.latestExtractionTouchAt), "MMM d, yyyy")}`
    : input.latestSourceDocumentAt
      ? `Latest source file ${format(new Date(input.latestSourceDocumentAt), "MMM d, yyyy")}`
      : "No source files attached yet";

  return [
    {
      label: "Owner",
      value: input.ownerLabel ?? "Unassigned",
      accent: input.ownerLabel ? "primary" : "attention",
      icon: "owner",
    },
    {
      label: "Next action",
      value: input.requiredNextStep || "No next action recorded",
      accent: input.requiredNextStep ? "primary" : "secondary",
      icon: "nextAction",
    },
    {
      label: "Reminders",
      value: reminderValue,
      accent: reminderAccent,
      icon: "reminders",
      footerHref:
        input.upcomingRemindersCount === 0 &&
        input.reminderHistoryCount === 0 &&
        input.approvedFieldsCount === 0
          ? "/settings/health"
          : undefined,
      footerLabel:
        input.upcomingRemindersCount === 0 &&
        input.reminderHistoryCount === 0 &&
        input.approvedFieldsCount === 0
          ? "Open Health diagnostics"
          : undefined,
    },
    {
      label: "Freshness",
      value: freshnessValue,
      accent: input.latestExtractionTouchAt || input.latestSourceDocumentAt ? "primary" : "attention",
      icon: "freshness",
    },
  ];
}

export function buildContractImmediateActions(input: {
  contractId: string;
  pendingFieldsCount: number;
  pendingApprovalsCount: number;
  openExceptionsCount: number;
  outstandingEvidenceCount: number;
  hasOwner: boolean;
  approvedFieldsCount: number;
}): ContractDetailImmediateAction[] {
  const items: Array<ContractDetailImmediateAction | null> = [
    input.pendingFieldsCount > 0
      ? {
          href: "#extracted-fields",
          eyebrow: "Confirm",
          title: "Suggested details need confirmation",
          hint: `${input.pendingFieldsCount} detail${input.pendingFieldsCount === 1 ? "" : "s"} are still unresolved before reminders or downstream tasks should rely on them.`,
          actionLabel: "Confirm details",
          tone: "attention" as const,
        }
      : null,
    input.pendingApprovalsCount > 0
      ? {
          href: `/contracts/approvals?status=pending&contract=${input.contractId}`,
          eyebrow: "Approvals",
          title: "Approvals still need action",
          hint: `${input.pendingApprovalsCount} approval request${input.pendingApprovalsCount === 1 ? "" : "s"} remain pending on this contract.`,
          actionLabel: "Open approvals",
          tone: "attention" as const,
        }
      : null,
    input.openExceptionsCount > 0
      ? {
          href: `/contracts/exceptions?status=open&contract=${input.contractId}`,
          eyebrow: "Issues",
          title: "Open issues need owner and resolution",
          hint: `${input.openExceptionsCount} active issue${input.openExceptionsCount === 1 ? "" : "s"} are still attached to this contract.`,
          actionLabel: "Open issues",
          tone: "risk" as const,
        }
      : null,
    input.outstandingEvidenceCount > 0
      ? {
          href: "#contract-evidence",
          eyebrow: "Evidence",
          title: "Evidence is still outstanding",
          hint: `${input.outstandingEvidenceCount} evidence requirement${input.outstandingEvidenceCount === 1 ? "" : "s"} still need submission or correction.`,
          actionLabel: "Review evidence",
          tone: "attention" as const,
        }
      : null,
    !input.hasOwner
      ? {
          href: "#ownership-record",
          eyebrow: "Ownership",
          title: "Assign an owner before tasks spread further",
          hint: "This contract is active without a visible owner for escalations, renewals, or follow-up.",
          actionLabel: "Assign owner",
          tone: "attention" as const,
        }
      : null,
    input.approvedFieldsCount === 0
      ? {
          href: "#extracted-fields",
          eyebrow: "Dates",
          title: "Reminders and renewals need confirmed dates",
          hint: "Confirm at least one key date before reminder scheduling and horizon reporting can trust this record.",
          actionLabel: "Confirm dates",
          tone: "attention" as const,
        }
      : null,
  ];
  return items.filter((value): value is ContractDetailImmediateAction => value !== null);
}
