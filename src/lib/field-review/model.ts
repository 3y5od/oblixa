import { attachOwnerProfiles } from "@/lib/contracts";
import {
  loadReviewQueueSignals,
  type ContractReviewStats,
  type ReviewQueueSignalRow,
} from "@/lib/contract-review-stats";
import type { createAdminClient } from "@/lib/supabase/server";
import type { Contract, ContractFile, ExtractedField, FieldStatus } from "@/lib/types";
import { formatReviewFieldLabel, getImportantFieldLabel, sortPendingFieldsForReview } from "./field-ordering";

// Re-exported so existing consumers/tests can keep importing them from the model.
export { formatReviewFieldLabel, getImportantFieldLabel, sortPendingFieldsForReview };

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

type OwnerSummary = {
  full_name: string | null;
  email: string | null;
};

export type FieldReviewContract = Contract & {
  owner?: OwnerSummary;
  contract_files?: ContractFile[];
  extracted_fields?: ExtractedField[];
};

export interface FieldReviewQueueItem {
  id: string;
  title: string;
  counterparty: string | null;
  ownerLabel: string;
  /** Operational owner user id (for the "mine" queue filter); null when unassigned. */
  ownerId: string | null;
  updatedAt: string;
  pendingFields: number;
  totalFields: number;
  /** True when the contract has searchable source text (a preview can render). */
  hasSourceText: boolean;
  /** True when the next pending field is an AI value with no citation yet —
   *  the row should flag that the first decision needs source text added. */
  nextNeedsCitation: boolean;
  /** True when any pending field maps to a Core important-field alias. */
  hasKeyField: boolean;
  href: string;
}

/** Queue rail filters. Bounded enum — the page validates `?qf` against these. */
export const REVIEW_QUEUE_FILTERS = [
  { key: "all", label: "All contracts" },
  { key: "mine", label: "Assigned to me" },
  { key: "key", label: "Important" },
  { key: "no-source", label: "No source preview" },
  { key: "needs-citation", label: "Needs source text" },
] as const;

export type ReviewQueueFilter = (typeof REVIEW_QUEUE_FILTERS)[number]["key"];

const REVIEW_QUEUE_FILTER_KEYS: readonly string[] = REVIEW_QUEUE_FILTERS.map((f) => f.key);

/** Validates a raw `?qf` param to a known filter; unknown/missing → "all". */
export function normalizeReviewQueueFilter(value: string | null | undefined): ReviewQueueFilter {
  return value && REVIEW_QUEUE_FILTER_KEYS.includes(value) ? (value as ReviewQueueFilter) : "all";
}

function matchesQueueFilter(
  item: FieldReviewQueueItem,
  filter: ReviewQueueFilter,
  viewerId: string | null
): boolean {
  switch (filter) {
    case "mine":
      return !!viewerId && item.ownerId === viewerId;
    case "key":
      return item.hasKeyField;
    case "no-source":
      return !item.hasSourceText;
    case "needs-citation":
      return item.nextNeedsCitation;
    default:
      return true;
  }
}

/** Pure filter+search over queue items. Operates on the FULL waiting set (the
 *  model now loads every waiting contract's signals), so filters and counts are
 *  workspace-wide, not page-scoped. Search matches title or counterparty. */
export function filterReviewQueueItems(
  items: FieldReviewQueueItem[],
  opts: { filter: ReviewQueueFilter; q?: string; viewerId?: string | null }
): FieldReviewQueueItem[] {
  const needle = (opts.q ?? "").trim().toLowerCase();
  const viewerId = opts.viewerId ?? null;
  return items.filter((item) => {
    if (!matchesQueueFilter(item, opts.filter, viewerId)) return false;
    if (needle.length === 0) return true;
    return (
      item.title.toLowerCase().includes(needle) ||
      (item.counterparty ?? "").toLowerCase().includes(needle) ||
      item.ownerLabel.toLowerCase().includes(needle)
    );
  });
}

/** Per-filter counts for the queue filter chips (ignores the search term). */
export function reviewQueueFilterCounts(
  items: FieldReviewQueueItem[],
  viewerId: string | null
): Record<ReviewQueueFilter, number> {
  return {
    all: items.length,
    mine: items.filter((i) => !!viewerId && i.ownerId === viewerId).length,
    key: items.filter((i) => i.hasKeyField).length,
    "no-source": items.filter((i) => !i.hasSourceText).length,
    "needs-citation": items.filter((i) => i.nextNeedsCitation).length,
  };
}

/** Source-support quality for a field's suggested value — the single source of
 *  truth the decision pane + evidence rail read instead of re-deriving trust. */
export type FieldSourceQuality = "located" | "snippet-missing" | "preview-unavailable" | "manual";

/** Per-contract review breakdown for the segmented progress bar. `skipped` is a
 *  session/nav concept (no DB status) and is always 0 from the server;
 *  `blockedNoSource` = pending fields on a contract that has no source text. */
export interface FieldReviewSegmentedProgress {
  reviewed: number;
  pending: number;
  unknown: number;
  skipped: number;
  blockedNoSource: number;
  total: number;
}

/** One entry in the in-contract field mini-queue (jump among pending fields). */
export interface FieldReviewMiniQueueItem {
  id: string;
  label: string;
  status: FieldStatus;
  href: string;
  isCurrent: boolean;
}

export interface FieldReviewActiveContract {
  id: string;
  title: string;
  counterparty: string | null;
  contractType: string | null;
  ownerLabel: string;
  status: Contract["status"];
  files: ContractFile[];
  href: string;
}

export interface FieldReviewActiveField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  suggestedValue: string | null;
  sourceSnippet: string | null;
  confidence: number | null;
  confidenceLabel: string;
  source: ExtractedField["source"];
  currentApprovedValue: string | null;
  /** True when a prior approved/edited value exists and differs from the
   *  current AI suggestion — approving will overwrite a different value. */
  approvedConflict: boolean;
  importantLabel: string | null;
  /** Plain-language consequence shown in the confirmation workbench. */
  impactCopy: string;
  needsCitation: boolean;
  /** Centralized source-support classification (replaces inline page logic). */
  sourceQuality: FieldSourceQuality;
}

export interface FieldReviewDocumentPreview {
  status: "available" | "unavailable";
  title: string;
  excerpt: string;
  /** True when the active field's source snippet was located inside the
   *  document text (so the excerpt actually shows supporting evidence). */
  snippetLocated: boolean;
  /** True when the active field's *value* (not just the surrounding clause) is
   *  locatable in the document. Source-backed trust requires this — a snippet
   *  that is found but does not contain the value does not support it. */
  valueLocated: boolean;
  /** The value text to highlight when {@link valueLocated}; null otherwise. */
  valueText: string | null;
  sourceFileNames: string[];
}

export interface FieldReviewProgress {
  contractsWaiting: number;
  fieldsWaiting: number;
  /** Contracts (workspace-wide) whose pending work has no searchable source text. */
  fieldsWithoutSource: number;
  /** Contracts (workspace-wide) whose next pending field is an AI value with no citation. */
  fieldsNeedingCitation: number;
  activeContractPosition: number;
  activeFieldPosition: number;
  activeContractPendingFields: number;
  activeContractTotalFields: number;
  activeContractSegments: FieldReviewSegmentedProgress;
}

export interface FieldReviewWorkspaceModel {
  page: number;
  pageSize: number;
  totalContracts: number;
  totalPages: number;
  /** Every waiting contract (workspace-wide), so filtering/counts are cross-page. */
  queue: FieldReviewQueueItem[];
  /** Per-filter counts over the full queue. */
  filterCounts: Record<ReviewQueueFilter, number>;
  /** Count of queue items matching the active filter + search. */
  filteredCount: number;
  /** Pending fields of the active contract, for the in-contract mini-queue. */
  activeFieldQueue: FieldReviewMiniQueueItem[];
  activeContract: FieldReviewActiveContract | null;
  activeField: FieldReviewActiveField | null;
  documentPreview: FieldReviewDocumentPreview | null;
  progress: FieldReviewProgress;
  prevHref: string | null;
  nextHref: string | null;
  skipHref: string | null;
  warnings: string[];
}

export interface FieldReviewWorkspaceParams {
  page?: number;
  contract?: string | null;
  field?: string | null;
  /** Current viewer (for the "mine" filter + server-side filtered selection). */
  viewerId?: string | null;
  /** Active queue filter + search — when provided the model resolves selection
   *  and counts against the filtered set; when omitted it returns the full set. */
  filter?: ReviewQueueFilter;
  q?: string;
}

export interface BuildFieldReviewWorkspaceInput {
  contracts: FieldReviewContract[];
  reviewStats?: Record<string, ContractReviewStats>;
  /** Full cross-page queue. When provided it is used directly (the loader path);
   *  when omitted the queue is derived from `contracts` (back-compat / tests). */
  queueItems?: FieldReviewQueueItem[];
  totalContracts?: number;
  page?: number;
  pageSize?: number;
  selectedContractId?: string | null;
  selectedFieldId?: string | null;
  viewerId?: string | null;
  filter?: ReviewQueueFilter;
  q?: string;
  warnings?: string[];
}

/** Display page size for the queue rail (the full queue is loaded; this paginates
 *  the rendered rows). */
export const REVIEW_QUEUE_PAGE_SIZE = 25;

const REVIEW_CONTRACT_COLUMNS =
  "id, organization_id, title, counterparty, contract_type, status, search_document, owner_id, created_by, created_at, updated_at, contract_files(*), extracted_fields(*)";

const PREVIEW_EXCERPT_CHARS = 720;

function normalizePage(page: unknown): number {
  return typeof page === "number" && Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatConfidence(confidence: number | null): string {
  if (confidence == null || Number.isNaN(confidence)) return "No model signal";
  return `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`;
}

export function deriveFieldImpactCopy(fieldName: string): string {
  const normalized = fieldName.toLowerCase();
  if (/(auto[_ -]?renew|evergreen)/.test(normalized)) {
    return "Shows whether the contract renews automatically, so renewal tasks and reports can flag contracts that continue unless cancelled.";
  }
  if (/(notice.*deadline|deadline.*notice)/.test(normalized)) {
    return "Records the last day to send notice, so Oblixa can warn before that deadline passes.";
  }
  if (/(notice.*window|window.*notice)/.test(normalized)) {
    return "Records the amount of advance notice required, so Oblixa can calculate the last day to send notice.";
  }
  if (/renewal/.test(normalized)) {
    return "Sets the date used for renewal reminders, renewal lists, and reports.";
  }
  if (/owner/.test(normalized)) {
    return "Assigns the responsible person for reminders, tasks, evidence requests, and reports.";
  }
  if (/(counterparty|party|vendor|supplier|customer)/.test(normalized)) {
    return "Identifies the other organization or person on the contract for search, grouping, and reports.";
  }
  if (/(payment|cadence|billing|invoice)/.test(normalized)) {
    return "Records payment timing and billing terms for contract tracking, tasks, and reports.";
  }
  if (/(value|fee|amount|price|cost|rate)/.test(normalized)) {
    return "Records contract value for inventory, prioritization, and reports.";
  }
  if (/(effective|start|commencement)/.test(normalized)) {
    return "Sets when the contract starts, so status, reminders, and reports use the correct date.";
  }
  if (/(termination|end|expiry|expiration|expires)/.test(normalized)) {
    return "Sets when the contract ends or terminates, so status, renewal timing, and reports use the correct date.";
  }
  if (/(obligation|requirement|deliverable|service[_ -]?level|sla)/.test(normalized)) {
    return "Records a contract requirement that may need a task, evidence request, or owner.";
  }
  if (/(governing|jurisdiction|law|venue)/.test(normalized)) {
    return "Records the law or jurisdiction that applies, so legal and contract questions can be routed correctly.";
  }
  return "After confirmation, this detail can appear in contract views, tasks, reminders, and reports.";
}

function ownerLabel(contract: FieldReviewContract): string {
  return contract.owner?.full_name ?? contract.owner?.email ?? "Unassigned";
}

function contractHref(contractId: string, page: number, fieldId?: string | null): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("contract", contractId);
  if (fieldId) params.set("field", fieldId);
  return `/contracts/review?${params.toString()}`;
}

function contractDetailHref(contractId: string): string {
  return `/contracts/${contractId}?tab=fields&from=review#extracted-fields`;
}

function buildDocumentPreview(
  contract: FieldReviewContract,
  activeField: ExtractedField | null
): FieldReviewDocumentPreview {
  const sourceFileNames = (contract.contract_files ?? []).map((file) => file.file_name);
  const rawDocument = typeof contract.search_document === "string" ? contract.search_document : "";
  const document = normalizeWhitespace(rawDocument);
  if (!document) {
    return {
      status: "unavailable",
      title: "Source preview unavailable",
      excerpt:
        sourceFileNames.length > 0
          ? "No searchable document text is available yet. Use the source snippet and attached file list while confirming this detail."
          : "No source file or searchable document text is attached to this contract.",
      snippetLocated: false,
      valueLocated: false,
      valueText: null,
      sourceFileNames,
    };
  }

  const snippet = activeField?.source_snippet ? normalizeWhitespace(activeField.source_snippet) : "";
  const value = activeField?.field_value ? normalizeWhitespace(activeField.field_value) : "";
  const lowerDocument = document.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const lowerValue = value.toLowerCase();
  const snippetIndex = lowerSnippet ? lowerDocument.indexOf(lowerSnippet.slice(0, 80)) : -1;
  // Source-backed trust requires the *value* itself to be locatable in the
  // document, not just the surrounding clause. Short values (< 4 chars) are too
  // ambiguous to locate reliably and are treated as not-located.
  const valueIndex = lowerValue.length >= 4 ? lowerDocument.indexOf(lowerValue) : -1;
  const valueLocated = valueIndex > -1;
  // Anchor the excerpt (and therefore the highlight) on the value when it is
  // located, so the highlighted span actually contains the value being
  // confirmed; otherwise fall back to the snippet clause for context.
  const anchor = valueLocated ? valueIndex : snippetIndex;
  const start =
    anchor > -1 ? Math.max(0, anchor - Math.floor(PREVIEW_EXCERPT_CHARS / 3)) : 0;
  const excerpt = document.slice(start, start + PREVIEW_EXCERPT_CHARS);

  return {
    status: "available",
    title: valueLocated || snippetIndex > -1 ? "Source preview near match" : "Source preview",
    excerpt:
      start > 0 || start + PREVIEW_EXCERPT_CHARS < document.length
        ? `${start > 0 ? "... " : ""}${excerpt}${start + PREVIEW_EXCERPT_CHARS < document.length ? " ..." : ""}`
        : excerpt,
    snippetLocated: snippetIndex > -1,
    valueLocated,
    valueText: valueLocated ? value : null,
    sourceFileNames,
  };
}

function currentApprovedValue(fields: ExtractedField[], activeField: ExtractedField): string | null {
  return (
    fields.find(
      (field) =>
        field.id !== activeField.id &&
        field.field_name === activeField.field_name &&
        (field.status === "approved" || field.status === "edited") &&
        field.field_value &&
        field.field_value.trim().length > 0
    )?.field_value ?? null
  );
}

/** A prior approved value conflicts with the suggestion when both exist and
 *  differ (case/space-insensitive) — approving would overwrite trusted data. */
function approvedValueConflicts(approved: string | null, suggested: string | null): boolean {
  if (!approved || !suggested) return false;
  return approved.trim().toLowerCase() !== suggested.trim().toLowerCase();
}

/** Classifies a field's source support — `manual` (human-entered), `located`
 *  (AI value located in the document), `preview-unavailable` (AI but no document
 *  to verify against), or `snippet-missing` (AI value not locatable, even if a
 *  surrounding clause was found). Source-backed status keys off the *value*
 *  being present, never just the snippet clause — a located clause that does not
 *  contain the value does not support it (release-state Data Confidence States). */
function deriveSourceQuality(
  field: ExtractedField,
  preview: FieldReviewDocumentPreview
): FieldSourceQuality {
  if (field.source !== "ai") return "manual";
  if (preview.valueLocated) return "located";
  if (preview.status !== "available") return "preview-unavailable";
  return "snippet-missing";
}

/** Per-contract review segments from extracted-field statuses. `reviewed`
 *  collapses approved+edited; `unknown` is `rejected`; `blockedNoSource` counts
 *  pending fields when the contract has no source text. */
function computeSegments(
  fields: ExtractedField[],
  hasSourceText: boolean
): FieldReviewSegmentedProgress {
  let reviewed = 0;
  let pending = 0;
  let unknown = 0;
  for (const field of fields) {
    if (field.status === "approved" || field.status === "edited") reviewed += 1;
    else if (field.status === "pending") pending += 1;
    else if (field.status === "rejected") unknown += 1;
  }
  return {
    reviewed,
    pending,
    unknown,
    skipped: 0,
    blockedNoSource: hasSourceText ? 0 : pending,
    total: fields.length,
  };
}

/** Back-compat queue item built from a loaded contract (used when the caller
 *  does not pass pre-built `queueItems`). */
function toQueueItem(
  contract: FieldReviewContract,
  stats: ContractReviewStats | undefined,
  page: number
): FieldReviewQueueItem {
  const pendingFields =
    stats?.pending ?? (contract.extracted_fields ?? []).filter((field) => field.status === "pending").length;
  const totalFields = stats?.total ?? (contract.extracted_fields ?? []).length;
  const nextField = sortPendingFieldsForReview(contract.extracted_fields ?? [])[0] ?? null;
  const hasSourceText =
    typeof contract.search_document === "string" && contract.search_document.trim().length > 0;
  const nextNeedsCitation =
    !!nextField &&
    nextField.source === "ai" &&
    !!nextField.field_value?.trim() &&
    !nextField.source_snippet?.trim();
  const hasKeyField = (contract.extracted_fields ?? []).some(
    (field) => field.status === "pending" && getImportantFieldLabel(field.field_name) !== null
  );
  return {
    id: contract.id,
    title: contract.title,
    counterparty: contract.counterparty,
    ownerLabel: ownerLabel(contract),
    ownerId: contract.owner_id ?? null,
    updatedAt: contract.updated_at,
    pendingFields,
    totalFields,
    hasSourceText,
    nextNeedsCitation,
    hasKeyField,
    href: contractHref(contract.id, page, nextField?.id),
  };
}

/** Cross-page queue item built from a lightweight signal row. */
function toQueueItemFromSignal(
  signal: ReviewQueueSignalRow,
  ownerLabelValue: string,
  page: number
): FieldReviewQueueItem {
  return {
    id: signal.id,
    title: signal.title,
    counterparty: signal.counterparty,
    ownerLabel: ownerLabelValue,
    ownerId: signal.ownerId,
    updatedAt: signal.updatedAt,
    pendingFields: signal.pendingFields,
    totalFields: signal.totalFields,
    hasSourceText: signal.hasSourceText,
    nextNeedsCitation: signal.nextNeedsCitation,
    hasKeyField: signal.hasKeyField,
    href: contractHref(signal.id, page, signal.nextFieldId),
  };
}

export function buildFieldReviewWorkspaceModel(
  input: BuildFieldReviewWorkspaceInput
): FieldReviewWorkspaceModel {
  const page = normalizePage(input.page);
  const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : REVIEW_QUEUE_PAGE_SIZE;
  const contracts = input.contracts;
  const reviewStats = input.reviewStats ?? {};

  // Full queue: prefer pre-built signal items (cross-page loader path); otherwise
  // derive from the loaded contracts (back-compat / unit tests).
  const queue =
    input.queueItems ??
    contracts
      .map((contract) => toQueueItem(contract, reviewStats[contract.id], page))
      .filter((item) => item.pendingFields > 0);

  const contractsWithPending = contracts.filter(
    (contract) => sortPendingFieldsForReview(contract.extracted_fields ?? []).length > 0
  );
  const selectedContract = input.selectedContractId
    ? contractsWithPending.find((contract) => contract.id === input.selectedContractId) ?? null
    : null;
  const activeContract = selectedContract ?? contractsWithPending[0] ?? null;
  const pendingFields = activeContract
    ? sortPendingFieldsForReview(activeContract.extracted_fields ?? [])
    : [];
  const selectedField =
    input.selectedFieldId && activeContract
      ? pendingFields.find((field) => field.id === input.selectedFieldId) ?? null
      : null;
  const activeField = selectedField ?? pendingFields[0] ?? null;
  const activeFieldIndex = activeField
    ? pendingFields.findIndex((field) => field.id === activeField.id)
    : -1;

  // Navigation: step within the active contract's pending fields; at the
  // boundary, cross to the adjacent contract in the FULL queue order.
  const activeQueueIndex = activeContract ? queue.findIndex((item) => item.id === activeContract.id) : -1;
  const nextQueueContract = activeQueueIndex > -1 ? queue[activeQueueIndex + 1] ?? null : null;
  const prevQueueContract = activeQueueIndex > 0 ? queue[activeQueueIndex - 1] ?? null : null;
  const nextField = activeFieldIndex > -1 ? pendingFields[activeFieldIndex + 1] ?? null : null;
  const prevField = activeFieldIndex > 0 ? pendingFields[activeFieldIndex - 1] ?? null : null;

  const nextHref = activeContract
    ? nextField
      ? contractHref(activeContract.id, page, nextField.id)
      : nextQueueContract?.href ?? null
    : null;
  const prevHref = activeContract
    ? prevField
      ? contractHref(activeContract.id, page, prevField.id)
      : prevQueueContract?.href ?? null
    : null;
  const skipHref = nextHref ?? (activeContract ? contractHref(activeContract.id, page) : null);

  const totalContracts = input.totalContracts ?? queue.length;
  const totalPages = Math.max(1, Math.ceil(totalContracts / pageSize));

  // Workspace-wide progress over the full queue.
  const fieldsWaiting = queue.reduce((sum, item) => sum + item.pendingFields, 0);
  const fieldsWithoutSource = queue.filter((item) => !item.hasSourceText).length;
  const fieldsNeedingCitation = queue.filter((item) => item.nextNeedsCitation).length;

  const activeApprovedValue =
    activeContract && activeField
      ? currentApprovedValue(activeContract.extracted_fields ?? [], activeField)
      : null;

  const documentPreview = activeContract ? buildDocumentPreview(activeContract, activeField) : null;

  const activeContractFields = activeContract?.extracted_fields ?? [];
  const activeHasSource =
    typeof activeContract?.search_document === "string" && activeContract.search_document.trim().length > 0;
  const activeContractSegments = computeSegments(activeContractFields, activeHasSource);

  const activeFieldQueue: FieldReviewMiniQueueItem[] = activeContract
    ? pendingFields.map((field) => ({
        id: field.id,
        label: formatReviewFieldLabel(field.field_name),
        status: field.status,
        href: contractHref(activeContract.id, page, field.id),
        isCurrent: !!activeField && field.id === activeField.id,
      }))
    : [];

  const viewerId = input.viewerId ?? null;
  const filterCounts = reviewQueueFilterCounts(queue, viewerId);
  const filtered = filterReviewQueueItems(queue, {
    filter: input.filter ?? "all",
    q: input.q,
    viewerId,
  });

  return {
    page,
    pageSize,
    totalContracts,
    totalPages,
    queue,
    filterCounts,
    filteredCount: filtered.length,
    activeFieldQueue,
    activeContract: activeContract
      ? {
          id: activeContract.id,
          title: activeContract.title,
          counterparty: activeContract.counterparty,
          contractType: activeContract.contract_type ?? null,
          ownerLabel: ownerLabel(activeContract),
          status: activeContract.status,
          files: activeContract.contract_files ?? [],
          href: contractDetailHref(activeContract.id),
        }
      : null,
    activeField:
      activeField && documentPreview
        ? {
            id: activeField.id,
            fieldName: activeField.field_name,
            fieldLabel: formatReviewFieldLabel(activeField.field_name),
            suggestedValue: activeField.field_value,
            sourceSnippet: activeField.source_snippet,
            confidence: activeField.confidence,
            confidenceLabel: formatConfidence(activeField.confidence),
            source: activeField.source,
            currentApprovedValue: activeApprovedValue,
            approvedConflict: approvedValueConflicts(activeApprovedValue, activeField.field_value),
            importantLabel: getImportantFieldLabel(activeField.field_name),
            impactCopy: deriveFieldImpactCopy(activeField.field_name),
            needsCitation:
              activeField.source === "ai" &&
              !!activeField.field_value?.trim() &&
              !activeField.source_snippet?.trim(),
            sourceQuality: deriveSourceQuality(activeField, documentPreview),
          }
        : null,
    documentPreview,
    progress: {
      contractsWaiting: queue.length,
      fieldsWaiting,
      fieldsWithoutSource,
      fieldsNeedingCitation,
      activeContractPosition: activeQueueIndex > -1 ? activeQueueIndex + 1 : 0,
      activeFieldPosition: activeFieldIndex > -1 ? activeFieldIndex + 1 : 0,
      activeContractPendingFields: pendingFields.length,
      activeContractTotalFields: activeContract?.extracted_fields?.length ?? 0,
      activeContractSegments,
    },
    prevHref,
    nextHref,
    skipHref,
    warnings: input.warnings ?? [],
  };
}

export async function loadFieldReviewWorkspaceModel(
  admin: Admin,
  orgId: string,
  params: FieldReviewWorkspaceParams
): Promise<FieldReviewWorkspaceModel> {
  const page = normalizePage(params.page);
  const warnings: string[] = [];

  // Full cross-page queue from lightweight signals (no document blobs).
  const signals = await loadReviewQueueSignals(admin, orgId);

  // Resolve owner display labels for the entire waiting set.
  const signalsWithOwners = await attachOwnerProfiles(
    admin,
    orgId,
    signals.map((signal) => ({ ...signal, owner_id: signal.ownerId }))
  );
  const queueItems = signals.map((signal, index) => {
    const owner = signalsWithOwners[index]?.owner;
    const label = owner?.full_name ?? owner?.email ?? "Unassigned";
    return toQueueItemFromSignal(signal, label, page);
  });

  // Active contract: the explicit `?contract` when it is a waiting contract,
  // otherwise the first waiting contract. Only its heavy detail is loaded.
  const activeId =
    params.contract && signals.some((signal) => signal.id === params.contract)
      ? params.contract
      : signals[0]?.id ?? null;

  let activeDetail: FieldReviewContract | null = null;
  if (activeId) {
    const { data, error } = await admin
      .from("contracts")
      .select(REVIEW_CONTRACT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("id", activeId)
      .limit(1);

    if (error) {
      console.error("[field-review] active contract query error:", error.message);
      warnings.push("Contract review data is partially unavailable.");
    } else {
      const row = (data ?? [])[0] as FieldReviewContract | undefined;
      if (row) {
        const [withOwner] = await attachOwnerProfiles(admin, orgId, [row]);
        activeDetail = withOwner ?? row;
      }
    }
  }

  return buildFieldReviewWorkspaceModel({
    contracts: activeDetail ? [activeDetail] : [],
    queueItems,
    totalContracts: queueItems.length,
    page,
    pageSize: REVIEW_QUEUE_PAGE_SIZE,
    selectedContractId: activeId,
    selectedFieldId: params.field,
    viewerId: params.viewerId,
    filter: params.filter,
    q: params.q,
    warnings,
  });
}
