import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { NAV_ITEMS, canAccessItem, type WorkspaceRole } from "@/lib/navigation";
import { EmptyState } from "@/components/ui/empty-state";

type Group = "operations" | "personal" | "workspace";

const GROUP_ORDER: Group[] = ["operations", "personal", "workspace"];
const GROUP_LABELS: Record<Group, string> = {
  operations: "Operations workflows",
  personal: "Personal views",
  workspace: "Workspace administration",
};

export default async function MoreToolsPage(props: {
  searchParams: Promise<{ q?: string; section?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const role = (ctx.role as WorkspaceRole | undefined) ?? "viewer";
  const params = await props.searchParams;
  const query = String(params.q ?? "").trim().toLowerCase();
  const selectedSection = (params.section ?? "").trim() as Group | "";

  const groups = GROUP_ORDER.map((group) => {
    const items = NAV_ITEMS.filter(
      (item) =>
        item.section === group &&
        canAccessItem(item, role) &&
        !["/contracts/renewals", "/contracts/intake", "/contracts/approvals"].includes(item.href)
    ).filter((item) => {
      if (selectedSection && group !== selectedSection) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.description} ${item.href}`.toLowerCase();
      return haystack.includes(query);
    });
    return {
      key: group,
      label: GROUP_LABELS[group],
      items,
    };
  }).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Navigation hub</p>
        <h1 className="ui-display-title mt-2">More tools</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          Access lower-frequency workflows without crowding the main sidebar.
        </p>
        <form action="/more" method="get" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search tools, pages, and workflows"
            className="ui-input-compact w-full sm:max-w-xl"
          />
          <select name="section" defaultValue={selectedSection} className="ui-input-compact sm:w-52">
            <option value="">All sections</option>
            <option value="operations">Operations</option>
            <option value="personal">Personal</option>
            <option value="workspace">Workspace</option>
          </select>
          <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]">
            Apply
          </button>
          {(query || selectedSection) && (
            <Link href="/more" className="ui-btn-ghost px-3 py-2 text-[12px]">
              Clear
            </Link>
          )}
        </form>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          title="No tools match your filters"
          copy="Try a broader search term or clear section filtering."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {groups.map((group) => (
            <section key={group.key} className="ui-card overflow-hidden">
              <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-4">
                <h2 className="ui-section-title">{group.label}</h2>
              </div>
              <ul className="divide-y divide-zinc-100">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-5 py-4 transition-colors hover:bg-zinc-50/70"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
