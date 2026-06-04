import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";

export default function ExternalMissingLinkPage() {
  return (
    <RouteStatePanel
      eyebrow="External workflow"
      title="Use the link from your email"
      copy="This page needs the secure link you were sent. Open the original email link again, or ask the requester to resend it."
      icon={<AlertCircle className="h-5 w-5" strokeWidth={1.65} />}
      shellClassName="bg-canvas min-h-[40vh] py-10"
      actions={
        <Link href="/" className="ui-btn-secondary px-4 py-2 text-sm">
          Oblixa home
        </Link>
      }
    />
  );
}
