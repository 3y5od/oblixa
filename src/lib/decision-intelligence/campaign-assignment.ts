/**
 * V5 §9.2 — portfolio_campaigns.assignment_json shape and task routing resolution.
 * Validated on PATCH/POST campaign and applied when previewing/syncing rows and starting campaigns.
 */

export type CampaignAssignmentSegmentRule = {
  teamKey?: string;
  assigneeId?: string;
};

export type CampaignAssignment = {
  /** Default contract_tasks.team_key / portfolio_campaign_contracts.assigned_team when row has none. */
  defaultTeamKey?: string;
  /** Default task assignee when segment rule does not override. */
  defaultAssigneeId?: string;
  /** Per segment_key (e.g. account key) overrides after backfill. */
  bySegment?: Record<string, CampaignAssignmentSegmentRule>;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isUuidLike(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

export function campaignAssignmentValidationError(): string {
  return "Invalid assignmentJson. Expected object with optional defaultTeamKey, defaultAssigneeId (uuid), bySegment map of { teamKey?, assigneeId? }.";
}

export function parseCampaignAssignmentJson(
  raw: unknown
): { ok: true; value: CampaignAssignment } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: campaignAssignmentValidationError() };
  }
  const o = raw as Record<string, unknown>;
  const value: CampaignAssignment = {};

  if (o.defaultTeamKey !== undefined) {
    if (!isNonEmptyString(o.defaultTeamKey)) {
      return { ok: false, error: "assignmentJson.defaultTeamKey must be a non-empty string when set." };
    }
    value.defaultTeamKey = o.defaultTeamKey.trim();
  }

  if (o.defaultAssigneeId !== undefined) {
    if (!isNonEmptyString(o.defaultAssigneeId) || !isUuidLike(o.defaultAssigneeId)) {
      return { ok: false, error: "assignmentJson.defaultAssigneeId must be a valid UUID when set." };
    }
    value.defaultAssigneeId = o.defaultAssigneeId.trim();
  }

  if (o.bySegment !== undefined) {
    if (typeof o.bySegment !== "object" || o.bySegment === null || Array.isArray(o.bySegment)) {
      return { ok: false, error: "assignmentJson.bySegment must be an object map." };
    }
    const bySeg: Record<string, CampaignAssignmentSegmentRule> = {};
    for (const [segKey, rule] of Object.entries(o.bySegment)) {
      if (!isNonEmptyString(segKey)) continue;
      if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
        return { ok: false, error: `assignmentJson.bySegment["${segKey}"] must be an object.` };
      }
      const r = rule as Record<string, unknown>;
      const entry: CampaignAssignmentSegmentRule = {};
      if (r.teamKey !== undefined) {
        if (!isNonEmptyString(r.teamKey)) {
          return { ok: false, error: `bySegment["${segKey}"].teamKey must be a non-empty string when set.` };
        }
        entry.teamKey = r.teamKey.trim();
      }
      if (r.assigneeId !== undefined) {
        if (!isNonEmptyString(r.assigneeId) || !isUuidLike(r.assigneeId)) {
          return { ok: false, error: `bySegment["${segKey}"].assigneeId must be a valid UUID when set.` };
        }
        entry.assigneeId = r.assigneeId.trim();
      }
      bySeg[segKey.trim()] = entry;
    }
    value.bySegment = bySeg;
  }

  return { ok: true, value };
}

/** Resolve task routing for a campaign contract row when starting work. */
export function resolveCampaignTaskRouting(args: {
  segmentKey: string | null | undefined;
  assignedTeam: string | null | undefined;
  assignment: CampaignAssignment;
}): { teamKey: string; assigneeId: string | null } {
  const seg = args.segmentKey?.trim() || null;
  const rowTeam = args.assignedTeam?.trim() || null;
  const segRule: CampaignAssignmentSegmentRule | undefined =
    seg && args.assignment.bySegment ? args.assignment.bySegment[seg] : undefined;

  const teamKey =
    rowTeam ||
    (segRule?.teamKey?.trim() ? segRule.teamKey.trim() : null) ||
    (args.assignment.defaultTeamKey?.trim() ? args.assignment.defaultTeamKey.trim() : null) ||
    "ops";

  const assigneeId =
    (segRule?.assigneeId?.trim() ? segRule.assigneeId.trim() : null) ||
    (args.assignment.defaultAssigneeId?.trim() ? args.assignment.defaultAssigneeId.trim() : null) ||
    null;

  return { teamKey, assigneeId };
}

/**
 * Compute assigned_team for a row if it is empty and assignment provides a default.
 * Returns null if no update needed.
 */
export function computeRowAssignedTeamPatch(
  row: { segment_key: string | null | undefined; assigned_team: string | null | undefined },
  assignment: CampaignAssignment
): string | null {
  if (row.assigned_team?.trim()) return null;
  const seg = row.segment_key?.trim() || null;
  if (seg) {
    const t = assignment.bySegment?.[seg]?.teamKey?.trim();
    if (t) return t;
  }
  const d = assignment.defaultTeamKey?.trim();
  return d || null;
}
