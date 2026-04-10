import Link from "next/link";
import { FileText } from "lucide-react";

export default function ContractNotFound() {
  return (
    <div className="flex items-center justify-center px-4 py-16 md:py-20">
      <div className="ui-card w-full max-w-md rounded-2xl border border-[var(--border-subtle)] px-8 py-10 text-center shadow-[var(--shadow-1)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-50">
          <FileText className="h-6 w-6 text-zinc-500" aria-hidden />
        </div>
        <p className="ui-eyebrow mt-5">Contracts</p>
        <h2 className="ui-section-title mt-2 text-xl">Contract not found</h2>
        <p className="ui-muted-tight mt-2 text-[13px]">
          This contract may have been deleted or you don&apos;t have access.
        </p>
        <Link href="/contracts" className="ui-btn-primary mt-8 inline-block px-5 py-2.5 text-[13px]">
          Back to contracts
        </Link>
      </div>
    </div>
  );
}
