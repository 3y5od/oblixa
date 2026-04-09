import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import { revalidatePath } from "next/cache";

type StatusFilter = "" | "open" | "in_progress" | "resolved" | "closed";
type SeverityFilter = "" | "low" | "medium" | "high" | "critical";

export default async function ExceptionsPage(props: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  const { status: rawStatus, severity: rawSeverity } = await props.searchParams;
  const status = (["", "open", "in_progress", "resolved", "closed"].includes(rawStatus ?? "")
    ? rawStatus
    : "") as StatusFilter;
  const severity = (["", "low", "medium", "high", "critical"].includes(rawSeverity ?? "")
    ? rawSeverity
    : "") as SeverityFilter;

  const ctx = await getAuthContext();
  if (!ctx) return null;
  const canEdit = canEditContracts(ctx.role as OrgRole);

  let query = ctx.admin
    .from("exceptions")
    .select("id, contract_id, title, exception_type, severity, status, owner_id, due_date, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);

  const [{ data: exceptions }, { data: contracts }, { data: events }, { data: members }] = await Promise.all([
    query,
    ctx.admin.from("contracts").select("id, title").eq("organization_id", ctx.orgId).limit(500),
    ctx.admin
      .from("exception_events")
      .select("id, exception_id, event_type, created_at")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(800),
    ctx.admin
      .from("organization_members")
      .select("user_id, profiles(full_name, email)")
      .eq("organization_id", ctx.orgId)
      .limit(200),
  ]);

  const contractById = new Map((contracts ?? []).map((row) => [row.id, row.title]));
  const eventsByException = new Map<string, Array<{ event_type: string; created_at: string }>>();
  for (const row of events ?? []) {
    const group = eventsByException.get(row.exception_id) ?? [];
    group.push({ event_type: row.event_type, created_at: row.created_at });
    eventsByException.set(row.exception_id, group);
  }
  const ownerOptions = (members ?? []).map((row) => {
    const profile = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return {
      id: row.user_id,
      label: profile?.full_name || profile?.email || "Member",
    };
  });

  async function assignAction(formData: FormData) {
    "use server";
    const auth = await getAuthContext();
    if (!auth) return;
    const exceptionId = String(formData.get("exceptionId") ?? "").trim();
    const ownerId = String(formData.get("ownerId") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
    if (!exceptionId || !ownerId) return;
    await auth.admin
      .from("exceptions")
      .update({ owner_id: ownerId, due_date: dueDate, status: "in_progress" })
      .eq("organization_id", auth.orgId)
      .eq("id", exceptionId);
    await auth.admin.from("exception_events").insert({
      organization_id: auth.orgId,
      exception_id: exceptionId,
      event_type: "assigned",
      actor_user_id: auth.user.id,
      details: { owner_id: ownerId, due_date: dueDate },
    });
    revalidatePath("/contracts/exceptions");
  }

  async function resolveAction(formData: FormData) {
    "use server";
    const auth = await getAuthContext();
    if (!auth) return;
    const exceptionId = String(formData.get("exceptionId") ?? "").trim();
    const resolutionNote = String(formData.get("resolutionNote") ?? "").trim() || null;
    if (!exceptionId) return;
    await auth.admin
      .from("exceptions")
      .update({ status: "resolved", resolution_note: resolutionNote, resolved_at: new Date().toISOString() })
      .eq("organization_id", auth.orgId)
      .eq("id", exceptionId);
    await auth.admin.from("exception_events").insert({
      organization_id: auth.orgId,
      exception_id: exceptionId,
      event_type: "resolved",
      actor_user_id: auth.user.id,
      details: { resolution_note: resolutionNote },
    });
    revalidatePath("/contracts/exceptions");
  }

  async function reopenAction(formData: FormData) {
    "use server";
    const auth = await getAuthContext();
    if (!auth) return;
    const exceptionId = String(formData.get("exceptionId") ?? "").trim();
    if (!exceptionId) return;
    await auth.admin
      .from("exceptions")
      .update({ status: "open", resolved_at: null, resolved_by: null })
      .eq("organization_id", auth.orgId)
      .eq("id", exceptionId);
    await auth.admin.from("exception_events").insert({
      organization_id: auth.orgId,
      exception_id: exceptionId,
      event_type: "reopened",
      actor_user_id: auth.user.id,
      details: {},
    });
    revalidatePath("/contracts/exceptions");
  }

  return (
    <div className="space-y-8">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Exceptions</p>
          <h1 className="ui-display-title mt-2">Exception ledger</h1>
          <p className="ui-muted mt-3">Live exception system of record with assignment, SLA tracking, and history.</p>
        </div>
      </header>

      <section className="ui-card p-5">
        <form action="/contracts/exceptions" method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <p className="ui-label-caps">Status</p>
            <select name="status" defaultValue={status} className="ui-input">
              <option value="">All</option>
              <option value="open">open</option>
              <option value="in_progress">in progress</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <div>
            <p className="ui-label-caps">Severity</p>
            <select name="severity" defaultValue={severity} className="ui-input">
              <option value="">All</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>
          <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px]">
            Apply filters
          </button>
        </form>
      </section>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Ledger entries</p>
        <ul className="mt-3 space-y-3">
          {(exceptions ?? []).length === 0 ? (
            <li className="text-sm text-zinc-500">No exceptions matched this filter.</li>
          ) : (
            (exceptions ?? []).map((item) => {
              const history = eventsByException.get(item.id) ?? [];
              return (
                <li key={item.id} className="rounded border border-zinc-200 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-900">{item.title}</p>
                    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px]">{item.status}</span>
                    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px]">{item.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.exception_type.replace(/_/g, " ")} ·{" "}
                    {item.contract_id ? (
                      <Link href={`/contracts/${item.contract_id}`} className="ui-link">
                        {contractById.get(item.contract_id) ?? item.contract_id}
                      </Link>
                    ) : (
                      "No linked contract"
                    )}
                    {item.due_date ? ` · due ${item.due_date}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Recent events:{" "}
                    {history.slice(0, 4).map((evt) => `${evt.event_type} (${new Date(evt.created_at).toLocaleDateString()})`).join(" · ") ||
                      "none"}
                  </p>
                  {canEdit ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <form action={assignAction} className="space-y-2 rounded border border-zinc-200 p-2">
                        <input type="hidden" name="exceptionId" value={item.id} />
                        <p className="ui-label-caps">Assign</p>
                        <select name="ownerId" className="ui-input text-xs" required defaultValue="">
                          <option value="" disabled>
                            Select owner
                          </option>
                          {ownerOptions.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.label}
                            </option>
                          ))}
                        </select>
                        <input type="date" name="dueDate" className="ui-input text-xs" />
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                          Save
                        </button>
                      </form>
                      <form action={resolveAction} className="space-y-2 rounded border border-zinc-200 p-2">
                        <input type="hidden" name="exceptionId" value={item.id} />
                        <p className="ui-label-caps">Resolve</p>
                        <textarea
                          name="resolutionNote"
                          className="ui-input min-h-[52px] text-xs"
                          placeholder="Resolution note"
                        />
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                          Mark resolved
                        </button>
                      </form>
                      <form action={reopenAction} className="space-y-2 rounded border border-zinc-200 p-2">
                        <input type="hidden" name="exceptionId" value={item.id} />
                        <p className="ui-label-caps">Reopen</p>
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                          Reopen exception
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
