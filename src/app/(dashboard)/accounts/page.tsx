import Link from "next/link";
import { Building2 } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";

export const metadata = { title: "Accounts — Oblixa" };

export default function AccountsBoundaryPage() {
  return (
    <RouteStatePanel
      eyebrow="Accounts"
      title="Accounts are handled through contracts"
      copy="Use Contracts to review counterparties, owners, work, evidence, and renewal context for the current workspace."
      icon={<Building2 className="h-6 w-6" strokeWidth={1.65} />}
      actions={
        <Link href="/contracts" className="ui-btn-primary px-5 py-2.5">
          Open contracts
        </Link>
      }
    />
  );
}
