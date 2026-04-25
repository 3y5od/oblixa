/** Row shape used only for default renewals list ordering (§13.3). */
export type RenewalQueueSortRow = {
  title: string;
  ownerLabel: string | null;
  openExceptions: number;
  outstandingEvidence: number;
  blocker: string | null;
  checkpointTotal: number;
  daysUntil: number | null;
  annualValue: number | null;
};

/**
 * Default renewals queue sort: readiness penalties first, then sooner dates, higher value, stable title.
 */
export function compareRenewalQueueRows(a: RenewalQueueSortRow, b: RenewalQueueSortRow): number {
  const readinessPenalty = (row: RenewalQueueSortRow) =>
    Number(!row.ownerLabel) * 5 +
    Number(row.openExceptions > 0) * 4 +
    Number(row.outstandingEvidence > 0) * 3 +
    Number(Boolean(row.blocker)) * 2 +
    Number(row.checkpointTotal === 0);
  const aPen = readinessPenalty(a);
  const bPen = readinessPenalty(b);
  if (bPen !== aPen) return bPen - aPen;
  if (a.daysUntil == null && b.daysUntil == null) return a.title.localeCompare(b.title);
  if (a.daysUntil == null) return 1;
  if (b.daysUntil == null) return -1;
  if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
  if ((b.annualValue ?? 0) !== (a.annualValue ?? 0)) {
    return (b.annualValue ?? 0) - (a.annualValue ?? 0);
  }
  return a.title.localeCompare(b.title);
}

export function getRenewalNextAction(input: {
  contractId: string;
  ownerAssigned?: boolean;
  openExceptions: number;
  outstandingEvidence: number;
  blocker?: string | null;
}) {
  if (input.ownerAssigned === false) {
    return {
      href: `/contracts/${input.contractId}?tab=overview#ownership-record`,
      label: "Assign owner",
    };
  }
  if (input.openExceptions > 0) {
    return {
      href: `/contracts/exceptions?status=open&contract=${input.contractId}`,
      label: "Resolve exceptions",
    };
  }
  if (input.outstandingEvidence > 0) {
    return {
      href: `/contracts/${input.contractId}?tab=overview#contract-evidence`,
      label: "Review evidence",
    };
  }
  if (input.blocker) {
    return {
      href: `/contracts/${input.contractId}?tab=overview#renewal-approvals`,
      label: "Review blocker",
    };
  }
  return {
    href: `/contracts/${input.contractId}?tab=overview#renewal-approvals`,
    label: "Open renewal workspace",
  };
}
