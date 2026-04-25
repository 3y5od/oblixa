import { addDays, startOfDay, subDays, isValid, parseISO } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";

export const DEADLINE_PRESET_VALUES = [
  "",
  "renewal_30",
  "renewal_90",
  "renewal_180",
  "renewal_365",
  "end_30",
  "end_90",
  "end_180",
  "end_365",
  "notice_deadline_30",
  "notice_deadline_90",
  "notice_deadline_180",
  "notice_deadline_365",
] as const;

export type DeadlinePreset = (typeof DEADLINE_PRESET_VALUES)[number];

/** Single source for parity tests: every non-empty `deadline=` / renewals `horizon=` token. */
export function listNonEmptyDeadlinePresets(): Exclude<DeadlinePreset, "">[] {
  return DEADLINE_PRESET_VALUES.filter((v): v is Exclude<DeadlinePreset, ""> => v !== "");
}

type CalendarDeadlinePreset = Exclude<
  DeadlinePreset,
  ""
    | "notice_deadline_30"
    | "notice_deadline_90"
    | "notice_deadline_180"
    | "notice_deadline_365"
>;

const PRESET_MAP: Record<
  CalendarDeadlinePreset,
  { field: string; days: number }
> = {
  renewal_30: { field: "renewal_date", days: 30 },
  renewal_90: { field: "renewal_date", days: 90 },
  renewal_180: { field: "renewal_date", days: 180 },
  renewal_365: { field: "renewal_date", days: 365 },
  end_30: { field: "end_date", days: 30 },
  end_90: { field: "end_date", days: 90 },
  end_180: { field: "end_date", days: 180 },
  end_365: { field: "end_date", days: 365 },
};

function parseEventDate(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const iso = parseISO(raw.trim());
  if (isValid(iso)) return startOfDay(iso);
  const d = new Date(raw.trim());
  return isValid(d) ? startOfDay(d) : null;
}

/**
 * Parse a notice-window string (e.g. "60 days", "30 days before renewal") into
 * a number of calendar days before renewal for deadline math.
 */
export function parseNoticeDays(noticeWindow: string | null): number | null {
  if (!noticeWindow?.trim()) return null;
  const t = noticeWindow.trim();
  const m = t.match(/(\d+)\s*(?:calendar\s+)?(?:day|days)\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const week = t.match(/(\d+)\s*(?:week|weeks)\b/i);
  if (week) {
    const n = parseInt(week[1], 10) * 7;
    return n > 0 ? n : null;
  }
  const month = t.match(/(\d+)\s*(?:month|months)\b/i);
  if (month) {
    const n = parseInt(month[1], 10) * 30;
    return n > 0 ? n : null;
  }
  const digits = t.match(/\d+/);
  if (digits) {
    const n = parseInt(digits[0], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Contracts where the last day to give notice (renewal_date minus notice_window)
 * falls within [today, today + horizonDays] (inclusive). Requires approved
 * renewal_date and parseable notice_window.
 */
export async function getContractIdsForNoticeDeadlineWindow(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  horizonDays: number
): Promise<string[]> {
  const { data } = await admin
    .from("extracted_fields")
    .select(
      "contract_id, field_name, field_value, contracts!inner(organization_id)"
    )
    .eq("contracts.organization_id", orgId)
    .eq("status", "approved")
    .in("field_name", ["renewal_date", "notice_window"])
    .not("field_value", "is", null)
    .limit(5000);

  const byContract = new Map<string, { renewal?: string; notice?: string }>();
  for (const row of data ?? []) {
    const cid = row.contract_id as string;
    const cur = byContract.get(cid) ?? {};
    if (row.field_name === "renewal_date") cur.renewal = row.field_value as string;
    if (row.field_name === "notice_window") cur.notice = row.field_value as string;
    byContract.set(cid, cur);
  }

  const today = startOfDay(new Date());
  const windowEnd = addDays(today, horizonDays);
  const ids = new Set<string>();

  for (const [cid, { renewal, notice }] of byContract) {
    const renewalDate = parseEventDate(renewal ?? null);
    const noticeDays = parseNoticeDays(notice ?? null);
    if (!renewalDate || !noticeDays) continue;
    const noticeDeadline = startOfDay(subDays(renewalDate, noticeDays));
    if (noticeDeadline >= today && noticeDeadline <= windowEnd) {
      ids.add(cid);
    }
  }

  return [...ids];
}

/**
 * Contract IDs with an approved date field whose event date falls within
 * [today, today + days] (inclusive).
 */
export async function getContractIdsForDeadlinePreset(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  preset: DeadlinePreset
): Promise<string[] | null> {
  if (!preset) return null;

  if (preset === "notice_deadline_30") {
    return await getContractIdsForNoticeDeadlineWindow(admin, orgId, 30);
  }
  if (preset === "notice_deadline_90") {
    return await getContractIdsForNoticeDeadlineWindow(admin, orgId, 90);
  }
  if (preset === "notice_deadline_180") {
    return await getContractIdsForNoticeDeadlineWindow(admin, orgId, 180);
  }
  if (preset === "notice_deadline_365") {
    return await getContractIdsForNoticeDeadlineWindow(admin, orgId, 365);
  }

  const cfg = PRESET_MAP[preset as CalendarDeadlinePreset];
  if (!cfg) return null;

  const { data } = await admin
    .from("extracted_fields")
    .select("contract_id, field_value, contracts!inner(organization_id)")
    .eq("contracts.organization_id", orgId)
    .eq("status", "approved")
    .eq("field_name", cfg.field)
    .not("field_value", "is", null)
    .limit(5000);

  const today = startOfDay(new Date());
  const windowEnd = addDays(today, cfg.days);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const event = parseEventDate(row.field_value as string);
    if (!event) continue;
    if (event >= today && event <= windowEnd) {
      ids.add(row.contract_id as string);
    }
  }
  return [...ids];
}

export async function getContractIdsMatchingFieldSearch(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  sanitizedTerm: string
): Promise<string[]> {
  if (!sanitizedTerm) return [];

  const pattern = `%${sanitizedTerm}%`;
  const { data } = await admin
    .from("extracted_fields")
    .select("contract_id, contracts!inner(organization_id)")
    .eq("contracts.organization_id", orgId)
    .neq("status", "rejected")
    .ilike("field_value", pattern)
    .limit(5000);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.contract_id as string);
  }
  return [...ids];
}

/** Critical date fields for “missing fields” reporting */
export const CRITICAL_DATE_FIELDS = [
  "end_date",
  "renewal_date",
  "notice_window",
] as const;
