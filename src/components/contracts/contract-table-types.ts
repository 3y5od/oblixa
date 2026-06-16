import type { ReactNode } from "react";
import type { Contract } from "@/lib/types";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import type { ContractListRowSignals } from "@/lib/contract-list-row-signals";

export interface ContractTableBulkActions {
  canEdit: boolean;
  members: { id: string; label: string }[];
  orgId: string;
}

export interface ContractTableEmptyStateConfig {
  title: string;
  copy: string;
  actionHref: string;
  actionLabel: string;
}

export interface ContractTableProps {
  contracts: Contract[];
  reviewStats?: Record<string, ContractReviewStats>;
  rowSignals?: Record<string, ContractListRowSignals>;
  showContinuityLinks?: boolean;
  footer?: ReactNode;
  filterFingerprint?: string;
  emptyState?: ContractTableEmptyStateConfig;
  bulkActions?: ContractTableBulkActions;
}
