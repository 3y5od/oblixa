import Link from "next/link";
import { format } from "date-fns";
import { getAuthContext } from "@/lib/supabase/server";
import { updateContractApprovalStatusForm } from "@/actions/approvals";

export default async function ApprovalsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;

  const query = admin
    .from("contract_approvals")
    .select("id, contract_id, approval_type, status, notes, created_at, contracts!inner(id, title, organization_id)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query.eq("status", status);
  }

  const [{ data: approvals }, { data: scenarios }] = await Promise.all([
    query,
    admin
      .from("contract_renewal_scenarios")
      .select("id, contract_id, scenario, blocker, updated_at, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Decision controls</p>
        <h1 className="ui-display-title">Approvals & scenarios</h1>
        <p className="max-w-2xl text-[15px] text-zinc-500">
          Track internal signoff for renewal/notice workflows and record current renewal scenarios.
        </p>
      </header>

      <div className="rounded-2xl border border-zinc-200/70 bg-white p-5">
        <form action="/contracts/approvals" method="get" className="flex items-end gap-3">
          <div>
            <label className="ui-label-caps" htmlFor="status">
              Approval status
            </label>
            <select id="status" name="status" defaultValue={status ?? ""} className="ui-input min-w-[14rem]">
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button className="ui-btn-primary px-5 py-2.5 text-[13px]" type="submit">
            Apply
          </button>
        </form>
      </div>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Approval queue</h2>
        </div>
        {(approvals?.length ?? 0) === 0 ? (
          <p className="px-6 py-6 text-sm text-zinc-500">No approvals found.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {approvals?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              return (
                <li key={row.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {row.approval_type.replace(/_/g, " ")} ·{" "}
                        {contract ? (
                          <Link className="ui-link" href={`/contracts/${contract.id}`}>
                            {contract.title}
                          </Link>
                        ) : (
                          "Contract"
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {format(new Date(row.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                      {row.notes && <p className="mt-1 text-xs text-zinc-600">{row.notes}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {row.status}
                      </span>
                      {row.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <form action={updateContractApprovalStatusForm}>
                            <input type="hidden" name="approvalId" value={row.id} />
                            <input type="hidden" name="status" value="approved" />
                            <button type="submit" className="ui-btn-secondary px-2.5 py-1 text-xs">
                              Approve
                            </button>
                          </form>
                          <form action={updateContractApprovalStatusForm}>
                            <input type="hidden" name="approvalId" value={row.id} />
                            <input type="hidden" name="status" value="rejected" />
                            <button type="submit" className="ui-btn-secondary px-2.5 py-1 text-xs">
                              Reject
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Renewal scenarios</h2>
        </div>
        {(scenarios?.length ?? 0) === 0 ? (
          <p className="px-6 py-6 text-sm text-zinc-500">No renewal scenarios recorded yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {scenarios?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              return (
                <li key={row.id} className="px-6 py-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {row.scenario.replace(/_/g, " ")} ·{" "}
                    {contract ? (
                      <Link className="ui-link" href={`/contracts/${contract.id}`}>
                        {contract.title}
                      </Link>
                    ) : (
                      "Contract"
                    )}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Updated {format(new Date(row.updated_at), "MMM d, yyyy h:mm a")}
                  </p>
                  {row.blocker && <p className="mt-1 text-xs text-amber-700">Blocker: {row.blocker}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
