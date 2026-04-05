import { getAuthContext } from "@/lib/supabase/server";
import { UploadForm } from "@/components/contracts/upload-form";

export default async function NewContractPage() {
  const ctx = await getAuthContext();

  if (!ctx) {
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
        <UploadForm organizationId={ctx.orgId} />
      </div>
    </div>
  );
}
