import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { createClient, getUserOrgId, ensureUserOrg } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const orgId = await getUserOrgId(user.id);
    if (!orgId) {
      const fullName = user.user_metadata?.full_name;
      await ensureUserOrg(
        user.id,
        fullName ? `${fullName}'s Organization` : "My Organization"
      );
    }
  }

  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        <Header
          fullName={user?.user_metadata?.full_name}
          email={user?.email}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-5 py-8 outline-none md:px-10 md:py-10"
        >
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
