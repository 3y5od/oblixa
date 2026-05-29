import {
  containsControlOrBidi,
  hasUnsafeJsonKey,
  isJsonShapeWithinLimits,
} from "@/lib/security/validation";

const CLIENT_STORAGE_JSON_MAX_LENGTH = 4096;
const CLIENT_STORAGE_JSON_LIMITS = {
  maxDepth: 4,
  maxArrayLength: 100,
  maxKeys: 40,
  maxStringLength: 512,
};
const STORAGE_SCOPE_RE = /^[a-zA-Z0-9._:-]{1,120}$/;

export const SIDEBAR_COLLAPSED_KEY = "oblixa.sidebar.collapsed";
export const REVIEW_QUEUE_GUIDE_DISMISSED_KEY =
  "oblixa.contracts.reviewQueueStartGuide.dismissed";
export const RECENT_COMMANDS_KEY = "oblixa.command-palette.recent";
export const DASHBOARD_COLLAPSED_SECTION_KEY_PREFIX =
  "oblixa.dashboard.collapsed.";
export const DASHBOARD_SECTION_ORDER_KEY = "oblixa.dashboard.section-order";
export const PRODUCT_MOBILE_CTA_DISMISSED_KEY =
  "oblixa-product-mobile-cta-dismissed";
export const CONTRACT_TABLE_SELECTION_KEY_PREFIX =
  "oblixa.contract-table.selection:";
export const UPLOAD_DRAFT_KEY_PREFIX = "oblixa.uploadDraft.v1:";
export const TABLE_DENSITY_KEY_PREFIX = "oblixa.table-density:";
export const RECENT_ITEMS_KEY_PREFIX = "oblixa.recent:";

export type StoredTableDensity = "compact" | "default" | "comfortable";

export type StoredRecentItem = {
  id: string;
  label: string;
  href: string;
  visitedAt: number;
};

export type StoredUploadMetadataDraft = {
  title: string;
  counterparty: string;
  ownerLabel: string;
  contractType: string;
  region: string;
  annualValue: string;
  tags: string;
  sourceSystem: string;
  externalReferenceId: string;
};

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function safeScope(value: string): string | null {
  const trimmed = value.trim();
  if (!STORAGE_SCOPE_RE.test(trimmed)) return null;
  if (containsControlOrBidi(trimmed)) return null;
  return trimmed;
}

function contractTableSelectionStorageKey(organizationId: string): string | null {
  const scope = safeScope(organizationId);
  return scope ? `${CONTRACT_TABLE_SELECTION_KEY_PREFIX}${scope}` : null;
}

function uploadDraftStorageKey(organizationId: string): string | null {
  const scope = safeScope(organizationId);
  return scope ? `${UPLOAD_DRAFT_KEY_PREFIX}${scope}` : null;
}

function tableDensityStorageKey(scopeValue: string): string | null {
  const scope = safeScope(scopeValue);
  return scope ? `${TABLE_DENSITY_KEY_PREFIX}${scope}` : null;
}

function recentItemsStorageKey(scopeValue: string): string | null {
  const scope = safeScope(scopeValue);
  return scope ? `${RECENT_ITEMS_KEY_PREFIX}${scope}` : null;
}

function dashboardCollapsedSectionStorageKey(scopeValue: string): string | null {
  const scope = safeScope(scopeValue);
  return scope ? `${DASHBOARD_COLLAPSED_SECTION_KEY_PREFIX}${scope}` : null;
}

function dashboardSectionOrderStorageKey(storageKey: string): string | null {
  const trimmed = storageKey.trim();
  if (trimmed === DASHBOARD_SECTION_ORDER_KEY) return DASHBOARD_SECTION_ORDER_KEY;
  const scope = safeScope(trimmed);
  if (!scope || !scope.startsWith(`${DASHBOARD_SECTION_ORDER_KEY}:`)) return null;
  return scope;
}

function isSafeRecentItem(value: unknown): value is StoredRecentItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    isSafeStoredString(v.id, 128) &&
    isSafeStoredString(v.label, 200) &&
    isSafeStoredHref(v.href) &&
    typeof v.visitedAt === "number" &&
    Number.isFinite(v.visitedAt)
  );
}

function readStoredJson(storage: Storage, key: string): unknown | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    if (raw.length > CLIENT_STORAGE_JSON_MAX_LENGTH) {
      storage.removeItem(key);
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (hasUnsafeJsonKey(parsed)) {
      storage.removeItem(key);
      return null;
    }
    if (!isJsonShapeWithinLimits(parsed, CLIENT_STORAGE_JSON_LIMITS)) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function writeStoredJson(storage: Storage, key: string, value: unknown): boolean {
  if (hasUnsafeJsonKey(value)) return false;
  if (!isJsonShapeWithinLimits(value, CLIENT_STORAGE_JSON_LIMITS)) return false;
  const serialized = JSON.stringify(value);
  if (serialized.length > CLIENT_STORAGE_JSON_MAX_LENGTH) return false;
  try {
    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

function readFlag(storage: Storage | null, key: string): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(key) === "1" || storage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(storage: Storage | null, key: string, value: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(key, value ? "1" : "0");
  } catch {
    // Ignore storage failures; UI state remains in memory.
  }
}

function isSafeStoredString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    !containsControlOrBidi(value)
  );
}

function isSafeStoredHref(value: unknown): value is string {
  return (
    isSafeStoredString(value, 256) &&
    value.startsWith("/") &&
    !value.startsWith("//")
  );
}

function safeUploadField(value: unknown, maxLength: number): string | null {
  return isSafeStoredString(value, maxLength) ? value : null;
}

export function readSidebarCollapsedPreference(): boolean {
  return readFlag(getLocalStorage(), SIDEBAR_COLLAPSED_KEY);
}

export function writeSidebarCollapsedPreference(value: boolean): void {
  writeFlag(getLocalStorage(), SIDEBAR_COLLAPSED_KEY, value);
}

export function readReviewQueueGuideDismissed(): boolean {
  return readFlag(getLocalStorage(), REVIEW_QUEUE_GUIDE_DISMISSED_KEY);
}

export function writeReviewQueueGuideDismissed(): void {
  writeFlag(getLocalStorage(), REVIEW_QUEUE_GUIDE_DISMISSED_KEY, true);
}

export function readTableDensityPreference(scope: string): StoredTableDensity | null {
  const storage = getLocalStorage();
  const key = tableDensityStorageKey(scope);
  if (!storage || !key) return null;
  try {
    const stored = storage.getItem(key);
    if (stored === "compact" || stored === "comfortable" || stored === "default") {
      return stored;
    }
    if (stored !== null) storage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

export function writeTableDensityPreference(
  scope: string,
  density: StoredTableDensity
): void {
  const storage = getLocalStorage();
  const key = tableDensityStorageKey(scope);
  if (!storage || !key) return;
  try {
    storage.setItem(key, density);
  } catch {
    // Ignore storage failures; UI state remains in memory.
  }
}

export function readCommandPaletteRecentCommands(): string[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  const parsed = readStoredJson(storage, RECENT_COMMANDS_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isSafeStoredHref).slice(0, 6);
}

export function writeCommandPaletteRecentCommands(next: string[]): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const safe = next.filter(isSafeStoredHref).slice(0, 6);
  writeStoredJson(storage, RECENT_COMMANDS_KEY, safe);
}

export function readDashboardCollapsedSection(
  storageKey: string
): "open" | "closed" | null {
  const storage = getLocalStorage();
  const key = dashboardCollapsedSectionStorageKey(storageKey);
  if (!storage || !key) return null;
  try {
    const stored = storage.getItem(key);
    if (stored === "open" || stored === "closed") return stored;
    if (stored !== null) storage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

export function writeDashboardCollapsedSection(
  storageKey: string,
  value: "open" | "closed"
): void {
  const storage = getLocalStorage();
  const key = dashboardCollapsedSectionStorageKey(storageKey);
  if (!storage || !key) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures; UI state remains in memory.
  }
}

export function readDashboardSectionOrder(storageKey = DASHBOARD_SECTION_ORDER_KEY): string[] {
  const storage = getLocalStorage();
  const key = dashboardSectionOrderStorageKey(storageKey);
  if (!storage || !key) return [];
  const parsed = readStoredJson(storage, key);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((value): value is string => isSafeStoredString(value, 128)).slice(0, 100);
}

export function writeDashboardSectionOrder(
  next: string[],
  storageKey = DASHBOARD_SECTION_ORDER_KEY
): void {
  const storage = getLocalStorage();
  const key = dashboardSectionOrderStorageKey(storageKey);
  if (!storage || !key) return;
  const safe = next.filter((value) => isSafeStoredString(value, 128)).slice(0, 100);
  writeStoredJson(storage, key, safe);
}

export function readProductMobileCtaDismissed(): boolean {
  return readFlag(getSessionStorage(), PRODUCT_MOBILE_CTA_DISMISSED_KEY);
}

export function writeProductMobileCtaDismissed(): void {
  writeFlag(getSessionStorage(), PRODUCT_MOBILE_CTA_DISMISSED_KEY, true);
}

export function readRecentItems(scope: string, limit = 5): StoredRecentItem[] {
  const storage = getLocalStorage();
  const key = recentItemsStorageKey(scope);
  if (!storage || !key) return [];
  const parsed = readStoredJson(storage, key);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isSafeRecentItem).slice(0, limit);
}

export function writeRecentItems(scope: string, items: StoredRecentItem[], limit = 5): void {
  const storage = getLocalStorage();
  const key = recentItemsStorageKey(scope);
  if (!storage || !key) return;
  const safe = items.filter(isSafeRecentItem).slice(0, limit);
  writeStoredJson(storage, key, safe);
}

export function clearStoredRecentItems(scope: string): void {
  const storage = getLocalStorage();
  const key = recentItemsStorageKey(scope);
  if (!storage || !key) return;
  storage.removeItem(key);
}

export function readContractTableSelection(organizationId: string): string[] {
  const storage = getSessionStorage();
  const key = contractTableSelectionStorageKey(organizationId);
  if (!storage || !key) return [];
  const parsed = readStoredJson(storage, key);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((value): value is string => isSafeStoredString(value, 128)).slice(0, 500);
}

export function writeContractTableSelection(
  organizationId: string,
  selectedIds: string[]
): void {
  const storage = getSessionStorage();
  const key = contractTableSelectionStorageKey(organizationId);
  if (!storage || !key) return;
  const safe = selectedIds.filter((value) => isSafeStoredString(value, 128)).slice(0, 500);
  if (safe.length === 0) {
    storage.removeItem(key);
    return;
  }
  writeStoredJson(storage, key, safe);
}

export function clearContractTableSelection(organizationId: string): void {
  const storage = getSessionStorage();
  const key = contractTableSelectionStorageKey(organizationId);
  if (!storage || !key) return;
  storage.removeItem(key);
}

export function readUploadMetadataDraft(
  organizationId: string
): Partial<StoredUploadMetadataDraft> | null {
  const storage = getSessionStorage();
  const key = uploadDraftStorageKey(organizationId);
  if (!storage || !key) return null;
  const parsed = readStoredJson(storage, key);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const raw = parsed as Record<string, unknown>;
  return {
    ...(safeUploadField(raw.title, 160) !== null ? { title: raw.title as string } : {}),
    ...(safeUploadField(raw.counterparty, 160) !== null ? { counterparty: raw.counterparty as string } : {}),
    ...(safeUploadField(raw.ownerLabel, 160) !== null ? { ownerLabel: raw.ownerLabel as string } : {}),
    ...(safeUploadField(raw.contractType, 80) !== null ? { contractType: raw.contractType as string } : {}),
    ...(safeUploadField(raw.region, 80) !== null ? { region: raw.region as string } : {}),
    ...(safeUploadField(raw.annualValue, 80) !== null ? { annualValue: raw.annualValue as string } : {}),
    ...(safeUploadField(raw.tags, 240) !== null ? { tags: raw.tags as string } : {}),
    ...(safeUploadField(raw.sourceSystem, 80) !== null ? { sourceSystem: raw.sourceSystem as string } : {}),
    ...(safeUploadField(raw.externalReferenceId, 160) !== null
      ? { externalReferenceId: raw.externalReferenceId as string }
      : {}),
  };
}

export function writeUploadMetadataDraft(
  organizationId: string,
  metadata: StoredUploadMetadataDraft
): void {
  const storage = getSessionStorage();
  const key = uploadDraftStorageKey(organizationId);
  if (!storage || !key) return;
  writeStoredJson(storage, key, {
    title: safeUploadField(metadata.title, 160) ?? "",
    counterparty: safeUploadField(metadata.counterparty, 160) ?? "",
    ownerLabel: safeUploadField(metadata.ownerLabel, 160) ?? "",
    contractType: safeUploadField(metadata.contractType, 80) ?? "",
    region: safeUploadField(metadata.region, 80) ?? "",
    annualValue: safeUploadField(metadata.annualValue, 80) ?? "",
    tags: safeUploadField(metadata.tags, 240) ?? "",
    sourceSystem: safeUploadField(metadata.sourceSystem, 80) ?? "",
    externalReferenceId: safeUploadField(metadata.externalReferenceId, 160) ?? "",
  });
}

export function clearUploadMetadataDraft(organizationId: string): void {
  const storage = getSessionStorage();
  const key = uploadDraftStorageKey(organizationId);
  if (!storage || !key) return;
  storage.removeItem(key);
}
