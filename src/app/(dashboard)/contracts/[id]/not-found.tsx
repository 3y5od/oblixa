import Link from "next/link";
import { FileText } from "lucide-react";

export default function ContractNotFound() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <FileText className="mx-auto h-12 w-12 text-zinc-400" />
        <h2 className="mt-4 text-lg font-semibold text-zinc-900">
          Contract not found
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          This contract may have been deleted or you don&apos;t have access.
        </p>
        <Link
          href="/contracts"
          className="mt-6 inline-block ui-btn-primary"
        >
          Back to contracts
        </Link>
      </div>
    </div>
  );
}
