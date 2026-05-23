import Link from "next/link";
import { FileText } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";

export default function ContractNotFound() {
  return (
    <RouteStatePanel
      eyebrow="Contracts"
      title="Contract not found"
      copy="This contract may have been deleted, moved out of scope, or you don't have access. Use the nearest safe workflow below instead of stopping here."
      icon={
        <FileText className="h-6 w-6 text-[var(--text-tertiary)]" aria-hidden />
      }
      cardClassName="ui-card-hero"
      actions={
        <>
          <Link href="/contracts" className="ui-btn-primary inline-flex px-5 py-2.5 text-[12.5px]">
            Back to contracts
          </Link>
          <Link href="/work" className="ui-btn-secondary inline-flex px-5 py-2.5 text-[12.5px]">
            Review Work hub
          </Link>
        </>
      }
    />
  );
}
