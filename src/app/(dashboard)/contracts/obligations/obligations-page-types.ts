export type ObligationStatusFilter = "" | "open" | "in_progress" | "done" | "waived";

export type ObligationViewRow = {
  id: string;
  title: string;
  obligationType: string;
  cadence: string | null;
  recurrenceType: string | null;
  recurrenceIntervalDays: number | null;
  nextDueDate: string | null;
  escalationDueAt: string | null;
  escalationStatus: string | null;
  dueDate: string | null;
  status: string;
  ownerId: string | null;
  updatedAt: string;
  contractId: string;
  contractTitle: string;
};

export type SavedObligationView = {
  id: string;
  name: string;
  href: string;
  weeklyActive: boolean;
  pinned: boolean;
};
