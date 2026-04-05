import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/contracts/upload-form";

export default async function NewContractPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-500">No organization found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Upload Contract
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <UploadForm organizationId={membership.organization_id} />
      </div>
    </div>
  );
}
