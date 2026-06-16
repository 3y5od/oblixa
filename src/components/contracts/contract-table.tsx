"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignContractOwners } from "@/actions/contracts";
import { surfaceTestIds } from "@/lib/qa/test-ids";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import {
  clearContractTableSelection,
  readContractTableSelection,
  writeContractTableSelection,
} from "@/lib/security/client-storage";
import { ContractTableBulkBar } from "./contract-table-bulk-bar";
import { ContractTableDesktop } from "./contract-table-desktop";
import { ContractTableEmptyState } from "./contract-table-empty-state";
import { ContractTableMobile } from "./contract-table-mobile";
import type { ContractTableProps } from "./contract-table-types";
import { buildContractTableRowModel } from "./contract-table-utils";

export function ContractTable({
  contracts,
  reviewStats,
  rowSignals,
  showContinuityLinks,
  footer,
  filterFingerprint,
  emptyState,
  bulkActions,
}: ContractTableProps) {
  const router = useRouter();
  const storageScope = bulkActions?.orgId ?? null;
  const [selectionLoaded, setSelectionLoaded] = useState(!storageScope);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkAssignPending, startBulkAssignTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const hydratedStorageScopeRef = useRef<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const selectedList = useMemo(() => [...selected], [selected]);
  const visibleSelectedCount = useMemo(
    () => contracts.filter((contract) => selected.has(contract.id)).length,
    [contracts, selected]
  );
  const hiddenSelectedCount = Math.max(0, selectedList.length - visibleSelectedCount);
  const allVisibleSelected = contracts.length > 0 && visibleSelectedCount === contracts.length;

  useEffect(() => {
    if (!storageScope) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const initialHydration = hydratedStorageScopeRef.current === null;
      const storedSelection = new Set(readContractTableSelection(storageScope));
      setSelected((current) => (initialHydration && current.size > 0 ? current : storedSelection));
      hydratedStorageScopeRef.current = storageScope;
      setSelectionLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storageScope]);

  useEffect(() => {
    if (!storageScope || !selectionLoaded) return;
    if (selected.size === 0) {
      clearContractTableSelection(storageScope);
      return;
    }
    writeContractTableSelection(storageScope, [...selected]);
  }, [selected, selectionLoaded, storageScope]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
  }, [allVisibleSelected, visibleSelectedCount]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const contract of contracts) next.delete(contract.id);
      } else {
        for (const contract of contracts) next.add(contract.id);
      }
      return next;
    });
  };

  if (contracts.length === 0) {
    return <ContractTableEmptyState emptyState={emptyState} />;
  }

  const exportHref =
    bulkActions && selectedList.length > 0
      ? `/api/export/contracts?orgId=${encodeURIComponent(bulkActions.orgId)}&contractIds=${encodeURIComponent(
          selectedList.join(",")
        )}`
      : null;
  const selectedContractIdsParam = selectedList.length > 0 ? encodeURIComponent(selectedList.join(",")) : null;
  const requestReviewHref = selectedContractIdsParam ? `/contracts/review?contractIds=${selectedContractIdsParam}` : null;
  const archiveHref = selectedContractIdsParam
    ? `/contracts/maintenance?action=archive&contractIds=${selectedContractIdsParam}`
    : null;

  // eslint-disable-next-line react-hooks/purity -- per-render clock used to compute Updated freshness gating
  const renderNow = Date.now();
  const rowModels = contracts.map((contract) =>
    buildContractTableRowModel({
      contract,
      stats: reviewStats?.[contract.id],
      sig: rowSignals?.[contract.id],
      renderNow,
    })
  );

  const handleBulkAssignSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isBulkAssignPending) return;
    setBulkError(null);
    const form = e.currentTarget;
    startBulkAssignTransition(async () => {
      const fd = new FormData(form);
      const res = await bulkAssignContractOwners(fd);
      if ("error" in res && res.error) {
        setBulkError(describeRecoverableMutationError(res.error));
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="min-w-0">
      {bulkActions && selectedList.length > 0 ? (
        <ContractTableBulkBar
          selectedList={selectedList}
          hiddenSelectedCount={hiddenSelectedCount}
          filterFingerprint={filterFingerprint}
          exportHref={exportHref}
          requestReviewHref={requestReviewHref}
          archiveHref={archiveHref}
          bulkActions={bulkActions}
          bulkError={bulkError}
          isBulkAssignPending={isBulkAssignPending}
          onClearSelection={() => setSelected(new Set())}
          onBulkAssignSubmit={handleBulkAssignSubmit}
        />
      ) : null}

      <div data-testid={surfaceTestIds.contractsTable} className="min-w-0 max-w-full">
        {!isNarrow ? (
          <ContractTableDesktop
            rowModels={rowModels}
            bulkActions={bulkActions}
            selected={selected}
            allVisibleSelected={allVisibleSelected}
            selectAllRef={selectAllRef}
            showContinuityLinks={showContinuityLinks}
            onToggleAllVisible={toggleAllVisible}
            onToggle={toggle}
          />
        ) : (
          <ContractTableMobile
            rowModels={rowModels}
            bulkActions={bulkActions}
            selected={selected}
            onToggle={toggle}
          />
        )}

        {footer}
      </div>
    </div>
  );
}
