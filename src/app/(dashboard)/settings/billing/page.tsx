import { getAuthContext } from "@/lib/supabase/server";
import { getStripeClient, resolveSubscriptionStatus } from "@/lib/stripe";
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
  const stripeClient = getStripeClient();

  if (org.stripe_subscription_id && stripeClient.ok) {
    try {
      const stripe = stripeClient.stripe;
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
    active: {
      icon: CheckCircle,
      color: "border border-emerald-200/80 bg-emerald-50 text-emerald-900",
      label: "Active",
    },
    trialing: {
      icon: CheckCircle,
      color: "border border-sky-200/80 bg-sky-50 text-sky-900",
      label: "Trial",
    },
    past_due: {
      icon: AlertCircle,
      color: "border border-amber-200/80 bg-amber-50 text-amber-900",
      label: "Past Due",
    },
    incomplete: {
      icon: AlertCircle,
      color: "border border-amber-200/80 bg-amber-50 text-amber-900",
      label: "Incomplete",
    },
    canceled: {
      icon: XCircle,
      color: "border border-red-200/80 bg-red-50 text-red-900",
      label: "Canceled",
    },
    none: {
      icon: XCircle,
      color: "border border-zinc-200 bg-zinc-50 text-zinc-700",
      label: "No Plan",
    },
  };

  const config = statusConfig[subscriptionStatus];
  const StatusIcon = config.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="border-b border-zinc-200/60 pb-8">
        <Link
          href="/settings"
          className="text-[13px] font-semibold text-zinc-500 transition-colors hover:text-[var(--accent)]"
        >
          ← Settings
        </Link>
        <p className="ui-eyebrow mt-6">Subscription</p>
        <h1 className="ui-display-title mt-2">Billing</h1>
        <p className="ui-muted mt-3">
          Plan status and Stripe customer portal access.
        </p>
      </header>

      {searchParams.success && (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-5 py-4 text-[14px] font-medium text-emerald-950">
          Subscription activated. Thank you!
        </div>
      )}
      {searchParams.canceled && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-5 py-4 text-[14px] font-medium text-amber-950">
          Checkout was canceled. No charges were made.
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-zinc-500">
        To require an active subscription before creating or editing contracts, set{" "}
        <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px]">
          REQUIRE_ACTIVE_SUBSCRIPTION=true
        </code>{" "}
        on the server.
      </p>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="ui-section-title text-base">Your plan</h2>
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${config.color}`}
            >
              <StatusIcon size={14} />
              {config.label}
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
        {isActive ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
              <p className="text-sm font-medium text-zinc-900">ContractOps Pro</p>
              <p className="text-sm text-zinc-500">
                Unlimited contracts, AI extraction, email reminders
              </p>
              {currentPeriodEnd && (
                <p className="mt-2 text-xs text-zinc-400">
                  Current period ends {currentPeriodEnd}
                </p>
              )}
            </div>
            {membership.role === "admin" && <ManageSubscriptionButton />}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/40 p-6">
              <h3 className="text-base font-bold tracking-tight text-zinc-900">
                ContractOps Pro
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-600" strokeWidth={2} />
                  Unlimited contract uploads
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-600" strokeWidth={2} />
                  AI-powered field extraction
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-600" strokeWidth={2} />
                  Email reminders for key dates
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-600" strokeWidth={2} />
                  Team collaboration
                </li>
              </ul>
              {membership.role === "admin" && (
                <div className="mt-4">
                  <SubscribeButton />
                </div>
              )}
              {membership.role !== "admin" && (
                <p className="mt-4 text-xs text-zinc-500">
                  Contact your organization admin to subscribe.
                </p>
              )}
            </div>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
