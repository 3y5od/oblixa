import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import {
  ReviewBoardCreateForm,
  ReviewBoardGenerateButton,
  ReviewBoardPatchPanel,
  ReviewBoardRunLifecycle,
} from "@/components/assurance/review-board-actions";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";
import type { WorkspaceRole } from "@/lib/navigation";

export default async function AssuranceReviewBoardsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6ReviewBoards");

  const role = ctx.role as WorkspaceRole;
  const canManageBoards = role === "admin" || role === "manager" || role === "ops_manager";

  const [{ data: boards }, { data: runs }] = await Promise.all([
    ctx.admin
      .from("review_boards")
      .select("id, name, board_type, cadence, active, agenda_template_json, subscriptions_json")
      .eq("organization_id", ctx.orgId)
      .order("updated_at", { ascending: false })
      .limit(50),
    ctx.admin
      .from("review_board_runs")
      .select(
        "id, review_board_id, status, generated_at, reviewed_at, agenda_json, packet_json, action_capture_json, decision_log_json"
      )
      .eq("organization_id", ctx.orgId)
      .order("generated_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <div className="space-y-6">
      <AssuranceListCard
        title="Review boards"
        subtitle="Assurance"
        explainer={
          <p>
            Boards use agenda templates and packet assembly from live findings, scorecards, campaigns, and decisions.
            Generate runs via <code className="rounded bg-zinc-100 px-1">POST /api/review-boards/&#123;id&#125;/generate-run</code>.
            Optional notification emails are stored under{" "}
            <Link className="ui-link" href="/assurance/autopilot">
              Assurance → Autopilot
            </Link>{" "}
            (org V6 settings; delivery wiring can follow).
          </p>
        }
      >
        <ReviewBoardCreateForm />
        <ul className="mt-4 space-y-2 text-sm">
          {(boards ?? []).map((row) => (
            <li key={row.id} className="rounded-lg border border-zinc-100 p-3">
              <p className="font-medium text-zinc-900">{row.name}</p>
              <p className="mt-1 text-xs text-zinc-600">
                {row.board_type} · {row.cadence} · {row.active ? "active" : "inactive"}
              </p>
              {row.active ? <ReviewBoardGenerateButton boardId={String(row.id)} /> : null}
              {canManageBoards ? (
                <ReviewBoardPatchPanel
                  boardId={String(row.id)}
                  initialSubscriptions={row.subscriptions_json ?? []}
                  initialAgendaTemplate={row.agenda_template_json ?? {}}
                  initialCadence={String(row.cadence ?? "weekly")}
                  initialActive={Boolean(row.active)}
                />
              ) : null}
              {row.agenda_template_json && Object.keys(row.agenda_template_json as object).length > 0 ? (
                <pre className="mt-2 max-h-24 overflow-auto rounded bg-zinc-50 p-2 text-[10px] text-zinc-600">
                  {JSON.stringify(row.agenda_template_json, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
          {(boards ?? []).length === 0 ? <li className="text-zinc-500">No review boards yet.</li> : null}
        </ul>
      </AssuranceListCard>

      <AssuranceListCard title="Recent board runs" subtitle="Assurance" explainer={<p>Latest generated packets.</p>}>
        <ul className="space-y-2 text-sm">
          {(runs ?? []).map((row) => (
            <li key={row.id} className="rounded-lg border border-zinc-100 p-3">
              <p className="font-medium text-zinc-900">
                {row.status} · {String(row.generated_at)}
                {row.reviewed_at ? <span className="text-zinc-500"> · reviewed {String(row.reviewed_at)}</span> : null}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Board {String(row.review_board_id)}</p>
              <ReviewBoardRunLifecycle
                runId={String(row.id)}
                status={String(row.status)}
                packetJson={
                  row.packet_json && typeof row.packet_json === "object"
                    ? (row.packet_json as Record<string, unknown>)
                    : null
                }
              />
              <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px]">
                <a
                  className="ui-link"
                  href={`/api/review-boards/runs/${encodeURIComponent(String(row.id))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Export JSON
                </a>
                <span className="text-zinc-300">·</span>
                <a
                  className="ui-link"
                  href={`/api/review-boards/runs/${encodeURIComponent(String(row.id))}?format=csv`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Export CSV
                </a>
                <span className="text-zinc-300">·</span>
                <Link className="ui-link" href={`/api/review-boards/${encodeURIComponent(String(row.review_board_id))}/runs`} target="_blank">
                  Runs JSON
                </Link>
              </p>
              {row.packet_json && typeof row.packet_json === "object" ? (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-zinc-50 p-2 text-[10px] text-zinc-600">
                  {JSON.stringify(row.packet_json, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
          {(runs ?? []).length === 0 ? <li className="text-zinc-500">No runs yet.</li> : null}
        </ul>
        <p className="mt-4 text-xs text-zinc-600">
          <Link className="ui-link" href="/api/review-boards" target="_blank">
            Boards JSON
          </Link>
          {" · "}
          <Link className="ui-link" href="/api/assurance/check-runs?limit=40" target="_blank">
            Check runs JSON
          </Link>
          {" · "}
          <Link className="ui-link" href="/api/assurance/analytics/summary" target="_blank">
            Analytics summary
          </Link>
          {" · "}
          <Link className="ui-link" href="/assurance">
            Back to assurance
          </Link>
        </p>
      </AssuranceListCard>
    </div>
  );
}
