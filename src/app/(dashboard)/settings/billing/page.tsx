import { getAuthContext } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { resolveSubscriptionStatus } from "@/lib/stripe";
import { SubscribeButton, ManageSubscriptionButton } from "@/components/settings/billing-actions";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function BillingPage(props: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { user, orgId, admin } = ctx;

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, organizations(id, name, stripe_customer_id, stripe_subscription_id)")
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .limit(1)
    .single();

  if (!membership) return null;

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  };

  let subscriptionStatus = resolveSubscriptionStatus(null);
  let currentPeriodEnd: string | null = null;

  if (org.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      subscriptionStatus = resolveSubscriptionStatus(sub);
      const firstItem = sub.items?.data?.[0];
      if (firstItem?.current_period_end) {
        currentPeriodEnd = new Date(
          firstItem.current_period_end * 1000
        ).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      subscriptionStatus = "none";
    }
  }

  const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    active: { icon: CheckCircle, color: "text-green-600 bg-green-50", label: "Active" },
    trialing: { icon: CheckCircle, color: "text-blue-600 bg-blue-50", label: "Trial" },
    past_due: { icon: AlertCircle, color: "text-amber-600 bg-amber-50", label: "Past Due" },
    canceled: { icon: XCircle, color: "text-red-600 bg-red-50", label: "Canceled" },
    none: { icon: XCircle, color: "text-gray-600 bg-gray-50", label: "No Plan" },
  };

  const config = statusConfig[subscriptionStatus];
  const StatusIcon = config.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-2">
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
          Settings
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
      </div>

      {searchParams.success && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          Subscription activated. Thank you!
        </div>
      )}
      {searchParams.canceled && (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-700">
          Checkout was canceled. No charges were made.
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Your Plan</h2>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${config.color}`}>
            <StatusIcon size={14} />
            {config.label}
          </div>
        </div>

        {isActive ? (
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">ContractOps Pro</p>
              <p className="text-sm text-gray-500">
                Unlimited contracts, AI extraction, email reminders
              </p>
              {currentPeriodEnd && (
                <p className="mt-2 text-xs text-gray-400">
                  Current period ends {currentPeriodEnd}
                </p>
              )}
            </div>
            {membership.role === "admin" && <ManageSubscriptionButton />}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-6">
              <h3 className="text-base font-semibold text-gray-900">
                ContractOps Pro
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  Unlimited contract uploads
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  AI-powered field extraction
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  Email reminders for key dates
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  Team collaboration
                </li>
              </ul>
              {membership.role === "admin" && (
                <div className="mt-4">
                  <SubscribeButton />
                </div>
              )}
              {membership.role !== "admin" && (
                <p className="mt-4 text-xs text-gray-500">
                  Contact your organization admin to subscribe.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
