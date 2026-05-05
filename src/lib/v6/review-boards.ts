import type { AdminClient } from "@/lib/v6/service";
import { createRow, listRows, updateRowById } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { deliverReviewBoardRunNotifications } from "@/lib/v6/review-board-notifications";
import { type BatchItemError } from "@/lib/route-runtime-contract";

function reviewBoardError(scope: string, diagnosticId: string, message: string): BatchItemError {
  return { scope, phase: "source_query", diagnostic_id: diagnosticId, message };
}

export async function assembleReviewBoardPacket(admin: AdminClient, orgId: string, boardId: string) {
  const [
    { data: findings, error: findingsErr },
    { data: scorecards, error: scorecardsErr },
    { data: campaigns, error: campaignsErr },
    { data: decisions, error: decisionsErr },
  ] = await Promise.all([
    admin
      .from("assurance_findings")
      .select("id, title, severity, status, finding_type, updated_at")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_review"])
      .order("updated_at", { ascending: false })
      .limit(40),
    admin
      .from("assurance_scorecards")
      .select("scorecard_type, entity_ref_id, overall_score, dimensions_json")
      .eq("organization_id", orgId)
      .order("overall_score", { ascending: true })
      .limit(25),
    admin
      .from("portfolio_campaigns")
      .select("id, name, status, campaign_type, updated_at, v6_effectiveness_json")
      .eq("organization_id", orgId)
      .in("status", ["active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(15),
    admin
      .from("decision_workspaces")
      .select("id, title, decision_type, status, due_at")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_review"])
      .order("due_at", { ascending: true })
      .limit(15),
  ]);
  const errors: BatchItemError[] = [];
  if (findingsErr) {
    console.error("assembleReviewBoardPacket: findings query failed", findingsErr.message);
    errors.push(reviewBoardError(`${orgId}:${boardId}:findings`, "v6_review_board_findings_query_failed", findingsErr.message));
  }
  if (scorecardsErr) {
    console.error("assembleReviewBoardPacket: scorecards query failed", scorecardsErr.message);
    errors.push(
      reviewBoardError(`${orgId}:${boardId}:scorecards`, "v6_review_board_scorecards_query_failed", scorecardsErr.message)
    );
  }
  if (campaignsErr) {
    console.error("assembleReviewBoardPacket: campaigns query failed", campaignsErr.message);
    errors.push(
      reviewBoardError(`${orgId}:${boardId}:campaigns`, "v6_review_board_campaigns_query_failed", campaignsErr.message)
    );
  }
  if (decisionsErr) {
    console.error("assembleReviewBoardPacket: decisions query failed", decisionsErr.message);
    errors.push(
      reviewBoardError(`${orgId}:${boardId}:decisions`, "v6_review_board_decisions_query_failed", decisionsErr.message)
    );
  }

  const agenda_json = {
    generated_at: nowIso(),
    sections: [
      { key: "findings", count: (findings ?? []).length },
      { key: "scorecards", count: (scorecards ?? []).length },
      { key: "campaigns", count: (campaigns ?? []).length },
      { key: "decisions", count: (decisions ?? []).length },
    ],
    board_id: boardId,
  };

  const campaign_drift = (campaigns ?? []).map((c) => {
    const row = c as { id: string; name?: string; v6_effectiveness_json?: { drift_score?: number; notes?: string } };
    const eff = row.v6_effectiveness_json ?? {};
    return {
      campaign_id: row.id,
      name: row.name ?? row.id,
      drift_score: typeof eff.drift_score === "number" ? eff.drift_score : null,
      notes: typeof eff.notes === "string" ? eff.notes : null,
    };
  });

  const packet_json = {
    generated_at: nowIso(),
    summary: {
      open_findings: (findings ?? []).length,
      lowest_scorecards: (scorecards ?? []).slice(0, 5),
      active_campaigns: (campaigns ?? []).length,
      open_decisions: (decisions ?? []).length,
      campaigns_with_drift_signal: campaign_drift.filter((x) => x.drift_score != null && x.drift_score > 0).length,
    },
    campaign_effectiveness: {
      drift_rows: campaign_drift,
    },
    drill_down: {
      findings: findings ?? [],
      scorecards: scorecards ?? [],
      campaigns: campaigns ?? [],
      decisions: decisions ?? [],
    },
  };

  return {
    agenda_json,
    packet_json,
    unresolved_findings_json: findings ?? [],
    errors,
  };
}

export function listReviewBoards(admin: AdminClient, orgId: string) {
  return listRows(
    admin,
    "review_boards",
    orgId,
    "id, name, board_type, cadence, active, updated_at, subscriptions_json, agenda_template_json"
  );
}

export async function patchReviewBoard(
  admin: AdminClient,
  orgId: string,
  boardId: string,
  payload: {
    subscriptions?: unknown[];
    agendaTemplate?: Record<string, unknown> | null;
    active?: boolean;
    cadence?: string;
  }
) {
  const updates: Record<string, unknown> = {};
  if (payload.subscriptions !== undefined) {
    updates.subscriptions_json = Array.isArray(payload.subscriptions) ? payload.subscriptions : [];
  }
  if (payload.agendaTemplate !== undefined) {
    updates.agenda_template_json =
      payload.agendaTemplate && typeof payload.agendaTemplate === "object" ? payload.agendaTemplate : {};
  }
  if (typeof payload.active === "boolean") updates.active = payload.active;
  if (payload.cadence !== undefined) {
    const c = payload.cadence.trim();
    if (c) updates.cadence = c;
  }
  if (Object.keys(updates).length === 0) {
    return { data: null as Record<string, unknown> | null, error: { message: "no_updates" } };
  }
  updates.updated_at = nowIso();
  return updateRowById(admin, "review_boards", orgId, boardId, updates);
}

export function createReviewBoard(
  admin: AdminClient,
  orgId: string,
  userId: string,
  payload: { name: string; boardType: string; cadence?: string }
) {
  return createRow(admin, "review_boards", orgId, {
    name: payload.name,
    board_type: payload.boardType,
    cadence: payload.cadence ?? "weekly",
    created_by: userId,
  });
}

export async function generateReviewBoardRun(admin: AdminClient, orgId: string, boardId: string, userId: string) {
  const { data: board, error: boardErr } = await admin
    .from("review_boards")
    .select("id, name, subscriptions_json")
    .eq("organization_id", orgId)
    .eq("id", boardId)
    .maybeSingle();

  if (boardErr || !board) {
    return { data: null, error: boardErr ?? { message: "board_not_found" } };
  }

  const assembled = await assembleReviewBoardPacket(admin, orgId, boardId);

  const result = await createRow(admin, "review_board_runs", orgId, {
    review_board_id: boardId,
    status: "generated",
    agenda_json: assembled.agenda_json,
    packet_json: assembled.packet_json,
    unresolved_findings_json: assembled.unresolved_findings_json,
    generated_by: userId,
  });

  if (!result.error && result.data?.id && board) {
    const packet = assembled.packet_json as { summary?: Record<string, unknown> };
    await deliverReviewBoardRunNotifications(admin, orgId, {
      boardId,
      boardName: String((board as { name?: string }).name ?? "Review board"),
      runId: String(result.data.id),
      subscriptions: (board as { subscriptions_json?: unknown }).subscriptions_json,
      packetSummary: packet.summary ?? {},
      source: "api",
    }).catch(() => undefined);
  }

  return {
    ...result,
    ...(assembled.errors.length > 0 ? { warnings: assembled.errors } : {}),
  };
}

export async function listReviewBoardRuns(admin: AdminClient, orgId: string, boardId: string) {
  const { data, error } = await admin
    .from("review_board_runs")
    .select("id, review_board_id, status, agenda_json, generated_at, reviewed_at")
    .eq("organization_id", orgId)
    .eq("review_board_id", boardId)
    .order("generated_at", { ascending: false })
    .limit(50);

  return { data: data ?? [], error };
}
