import Link from "next/link";
import { Landmark } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";

export const metadata = { title: "Counterparties — Oblixa" };

export default function CounterpartiesBoundaryPage() {
  return (
    <RouteStatePanel
      eyebrow="Counterparties"
      title="Counterparty context is in contracts"
      copy="Use Contracts to inspect signed agreements, owners, dates, work, evidence, and operational follow-up by counterparty."
      icon={<Landmark className="h-6 w-6" strokeWidth={1.65} />}
      actions={
        <Link href="/contracts" className="ui-btn-primary px-5 py-2.5">
          Open contracts
        </Link>
      }
    />
  );
}
