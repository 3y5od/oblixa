import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
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
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Compare view</p>
        <h1 className="ui-display-title mt-2">Decision compare</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
          Side-by-side snapshot of type, status, dates, and structured recommendation or disposition payloads.
        </p>
      </header>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Pick workspaces</p>
        <form className="mt-4 grid gap-4 md:grid-cols-2" method="get" action="/decisions/compare">
          <label className="text-xs font-medium text-zinc-600">
            Decision A
            <select name="decisionA" className="ui-input-compact mt-1 w-full" defaultValue={decisionA ?? ""}>
              <option value="">—</option>
              {(decisionList ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.status})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-600">
            Decision B
            <select name="decisionB" className="ui-input-compact mt-1 w-full" defaultValue={decisionB ?? ""}>
              <option value="">—</option>
              {(decisionList ?? []).map((d) => (
                <option key={`b-${d.id}`} value={d.id}>
                  {d.title} ({d.status})
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="ui-btn-secondary px-4 py-2 text-sm">
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
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{line.k}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-800">{line.v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Select decision A above.</p>
          )}
          {one.data?.id ? (
            <Link href={`/decisions/${one.data.id}`} className="ui-link mt-4 inline-block text-xs">
              Open workspace
            </Link>
          ) : null}
        </article>
        <article className="ui-card p-5">
          <p className="ui-label-caps">{right?.label ?? "Decision B"}</p>
          {right ? (
            <dl className="mt-4 space-y-3 text-sm">
              {right.lines.map((line) => (
                <div key={line.k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{line.k}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-800">{line.v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Select decision B above.</p>
          )}
          {two.data?.id ? (
            <Link href={`/decisions/${two.data.id}`} className="ui-link mt-4 inline-block text-xs">
              Open workspace
            </Link>
          ) : null}
        </article>
      </section>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/decisions" className="ui-link">
          Back to decisions
        </Link>
        {" · "}
        <Link href="/decisions/review" className="ui-link">
          Manager review list
        </Link>
      </p>
    </div>
  );
}
