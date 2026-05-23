import Link from "next/link";
import { Split } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { DECISION_TYPE_LABELS, type DecisionType } from "@/lib/v5/decision-types";

export default async function DecisionsComparePage(props: {
  searchParams: Promise<{ decisionA?: string; decisionB?: string }>;
}) {
  const { decisionA, decisionB } = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5DecisionFoundation");
  assertV5PageFeature("v5ControlRoomUx");

  const { admin, orgId } = ctx;

  const { data: decisionList } = await admin
    .from("decision_workspaces")
    .select("id, title, status")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(150);

  const [one, two] = await Promise.all([
    decisionA
      ? admin
          .from("decision_workspaces")
          .select(
            "id, title, decision_type, status, due_at, recommendation_json, final_disposition_json, updated_at"
          )
          .eq("organization_id", orgId)
          .eq("id", decisionA)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    decisionB
      ? admin
          .from("decision_workspaces")
          .select(
            "id, title, decision_type, status, due_at, recommendation_json, final_disposition_json, updated_at"
          )
          .eq("organization_id", orgId)
          .eq("id", decisionB)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  function summarize(
    row: NonNullable<typeof one.data>,
    label: string
  ): { label: string; lines: { k: string; v: string }[] } {
    const dt = row.decision_type as DecisionType;
    const typeLabel = DECISION_TYPE_LABELS[dt] ?? row.decision_type;
    const rec =
      row.recommendation_json && typeof row.recommendation_json === "object"
        ? JSON.stringify(row.recommendation_json).slice(0, 280)
        : "—";
    const disp =
      row.final_disposition_json && typeof row.final_disposition_json === "object"
        ? JSON.stringify(row.final_disposition_json).slice(0, 280)
        : "—";
    return {
      label,
      lines: [
        { k: "Title", v: row.title },
        { k: "Type", v: typeLabel },
        { k: "Status", v: row.status },
        { k: "Due", v: row.due_at ? new Date(row.due_at).toLocaleString() : "—" },
        { k: "Updated", v: row.updated_at ? new Date(row.updated_at).toLocaleString() : "—" },
        { k: "Recommendation (excerpt)", v: rec },
        { k: "Disposition (excerpt)", v: disp },
      ],
    };
  }

  const left = one.data ? summarize(one.data, "Decision A") : null;
  const right = two.data ? summarize(two.data, "Decision B") : null;

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Split className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Compare view"
        title="Decision compare"
        lead="Side-by-side snapshot of type, status, dates, and structured recommendation or disposition payloads."
      />

      <section className="ui-card p-5 md:p-6">
        <p className="ui-eyebrow">Selection</p>
        <p className="ui-section-title mt-1 text-base">Pick workspaces</p>
        <form className="mt-4 space-y-4" method="get" action="/decisions/compare">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="compare-decision-a" className="ui-label-caps">
                Decision A
              </label>
              <select
                id="compare-decision-a"
                name="decisionA"
                className="ui-input mt-1 w-full min-w-0"
                defaultValue={decisionA ?? ""}
              >
                <option value="">—</option>
                {(decisionList ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="compare-decision-b" className="ui-label-caps">
                Decision B
              </label>
              <select
                id="compare-decision-b"
                name="decisionB"
                className="ui-input mt-1 w-full min-w-0"
                defaultValue={decisionB ?? ""}
              >
                <option value="">—</option>
                {(decisionList ?? []).map((d) => (
                  <option key={`b-${d.id}`} value={d.id}>
                    {d.title} ({d.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <button type="submit" className="ui-btn-primary px-5 py-2.5 text-[12.5px]">
              Apply
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="ui-card p-5">
          <p className="ui-label-caps">{left?.label ?? "Decision A"}</p>
          {left ? (
            <dl className="mt-4 space-y-3 text-sm">
              {left.lines.map((line) => (
                <div key={line.k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{line.k}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-[var(--text-primary)]">{line.v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-tertiary)]">Select decision A above.</p>
          )}
          {one.data?.id ? (
            <Link href={`/decisions/${one.data.id}`} className="ui-link mt-4 inline-block text-xs">
              Review workspace
            </Link>
          ) : null}
        </article>
        <article className="ui-card p-5">
          <p className="ui-label-caps">{right?.label ?? "Decision B"}</p>
          {right ? (
            <dl className="mt-4 space-y-3 text-sm">
              {right.lines.map((line) => (
                <div key={line.k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{line.k}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-[var(--text-primary)]">{line.v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-tertiary)]">Select decision B above.</p>
          )}
          {two.data?.id ? (
            <Link href={`/decisions/${two.data.id}`} className="ui-link mt-4 inline-block text-xs">
              Review workspace
            </Link>
          ) : null}
        </article>
      </section>

      <nav
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-sm text-[var(--text-tertiary)]"
        aria-label="Decision shortcuts"
      >
        <Link href="/decisions" className="ui-link">
          Back to decisions
        </Link>
        <span className="text-[var(--text-tertiary)]" aria-hidden>
          ·
        </span>
        <Link href="/decisions/review" className="ui-link">
          Manager review list
        </Link>
      </nav>
    </div>
  );
}
