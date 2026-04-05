import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            {user?.user_metadata?.full_name || user?.email}
          </p>
          {user?.user_metadata?.full_name && (
            <p className="text-xs text-gray-500">{user?.email}</p>
          )}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
          {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "?").toUpperCase()}
        </div>
      </div>
    </header>
  );
}
