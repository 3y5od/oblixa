import Link from "next/link";
import { UiAlert } from "@/components/ui/ui-alert";

export function BillingMembershipQueryFailed() {
  return (
    <div className="ui-page-stack mx-auto max-w-5xl gap-4">
      <UiAlert tone="warning">
        We couldn&apos;t load your workspace membership. Refresh to try again, or contact{" "}
        <Link href="mailto:support@oblixa.com" className="ui-link font-mono">
          support@oblixa.com
        </Link>
        .
      </UiAlert>
    </div>
  );
}

export function BillingAccessRevoked() {
  return (
    <div className="ui-page-stack mx-auto max-w-5xl gap-4">
      <UiAlert tone="warning">
        Access revoked. Contact your workspace admin or visit{" "}
        <Link href="/settings/team" className="ui-link">
          Settings - Team
        </Link>
        .
      </UiAlert>
    </div>
  );
}
