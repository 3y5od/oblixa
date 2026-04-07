import Link from "next/link";
import { markNotificationReadVoid } from "@/actions/field-comments";
import { getAuthContext } from "@/lib/supabase/server";

export default async function CollaborationPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId, user } = ctx;

  const [{ data: comments }, { data: notifications }] = await Promise.all([
    admin
      .from("contract_field_comments")
      .select("id, comment, created_at, contract_id, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("internal_notifications")
      .select("id, title, body, read_at, entity_type, entity_id, created_at")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Cross-team coordination</p>
        <h1 className="ui-display-title">Collaboration workspace</h1>
        <p className="max-w-2xl text-[15px] text-zinc-500">
          Field-level comments, mentions, and in-app notifications for handoffs and clarifications.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
            <h2 className="ui-section-title text-base">Recent field comments</h2>
          </div>
          {comments?.length ? (
            <ul className="divide-y divide-zinc-100">
              {comments.map((row) => {
                const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                  | { id: string; title: string }
                  | undefined;
                return (
                  <li key={row.id} className="px-6 py-4">
                    <p className="text-sm text-zinc-700">{row.comment}</p>
                    {contract && (
                      <Link href={`/contracts/${contract.id}`} className="mt-1 inline-block text-xs ui-link">
                        {contract.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-zinc-500">No comments yet.</p>
          )}
        </section>

        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
            <h2 className="ui-section-title text-base">My notifications</h2>
          </div>
          {notifications?.length ? (
            <ul className="divide-y divide-zinc-100">
              {notifications.map((row) => (
                <li key={row.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{row.title}</p>
                      {row.body && <p className="mt-1 text-xs text-zinc-600">{row.body}</p>}
                      <p className="mt-1 text-xs text-zinc-500">
                        {new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")}
                      </p>
                    </div>
                    {!row.read_at && (
                      <form action={markNotificationReadVoid.bind(null, row.id)}>
                        <button className="ui-btn-secondary px-3 py-1.5 text-xs" type="submit">
                          Mark read
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-zinc-500">No notifications yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
