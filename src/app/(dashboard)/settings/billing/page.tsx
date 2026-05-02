import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getStripeClient, resolveSubscriptionStatus } from "@/lib/stripe";
import { SubscribeButton, ManageSubscriptionButton } from "@/components/settings/billing-actions";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function BillingPage(props: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { user, orgId, admin } = ctx;

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, organizations(id, name, stripe_customer_id, stripe_subscription_id)")
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .limit(1)
    .single();

  if (!membership) return <WorkspaceRequiredState />;

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  };

  let subscriptionStatus = resolveSubscriptionStatus(null);
  let currentPeriodEnd: string | null = null;
  const stripeClient = await getStripeClient();

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
      color: "ui-status-badge ui-status-badge-healthy",
      label: "Active",
    },
    trialing: {
      icon: CheckCircle,
      color: "ui-status-badge ui-status-badge-info",
      label: "Trial",
    },
    past_due: {
      icon: AlertCircle,
      color: "ui-status-badge ui-status-badge-warning",
      label: "Past Due",
    },
    incomplete: {
      icon: AlertCircle,
      color: "ui-status-badge ui-status-badge-warning",
      label: "Incomplete",
    },
    canceled: {
      icon: XCircle,
      color: "ui-status-badge ui-status-badge-critical",
      label: "Canceled",
    },
    none: {
      icon: XCircle,
      color: "ui-status-badge ui-status-badge-empty",
      label: "No Plan",
    },
  };

  const config = statusConfig[subscriptionStatus];
  const StatusIcon = config.icon;

  return (
    <div className="ui-page-stack mx-auto max-w-3xl">
      <header className="ui-page-header">
        <Link
          href="/settings"
          className="text-[13px] font-semibold text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent)]"
        >
          ← Settings
        </Link>
        <div className="mt-6">
          <p className="ui-eyebrow">Subscription</p>
          <h1 className="ui-display-title mt-2">Billing</h1>
          <p className="ui-page-lead mt-3">Plan status and Stripe customer portal access.</p>
        </div>
      </header>

      {searchParams.success && (
        <div className="ui-alert-success px-5 py-4 text-[14px] font-medium">
          Subscription activated. Thank you!
        </div>
      )}
      {searchParams.canceled && (
        <div className="ui-alert-warning px-5 py-4 text-[14px] font-medium">
          Checkout was canceled. No charges were made.
        </div>
      )}

      <p className="ui-support-copy text-[12px]">
        To require an active subscription before creating or editing contracts, set{" "}
        <code className="rounded-md bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1.5 py-0.5 font-mono text-[11px]">
          REQUIRE_ACTIVE_SUBSCRIPTION=true
        </code>{" "}
        on the server.
      </p>

      <section className="ui-page-shell overflow-hidden">
        <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-eyebrow">Stripe</p>
              <h2 className="ui-section-title mt-1 text-base">Your plan</h2>
              <p className="ui-support-copy mt-1">Use billing as the commercial control layer for plan posture, upgrade state, and who can open the Stripe portal.</p>
            </div>
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
            <div className="ui-soft-details p-4">
              <p className="text-sm font-medium text-[var(--text-primary)]">Oblixa Pro</p>
              <p className="text-sm text-[var(--text-tertiary)]">
                Unlimited contracts, AI extraction, email reminders
              </p>
              {currentPeriodEnd && (
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  Current period ends {currentPeriodEnd}
                </p>
              )}
            </div>
            {membership.role === "admin" && <ManageSubscriptionButton />}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="ui-status-panel ui-status-panel-info p-6">
              <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                Oblixa Pro
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--success-ink)]" strokeWidth={2} />
                  Unlimited contract uploads
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--success-ink)]" strokeWidth={2} />
                  AI-powered field extraction
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--success-ink)]" strokeWidth={2} />
                  Email reminders for key dates
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--success-ink)]" strokeWidth={2} />
                  Team collaboration
                </li>
              </ul>
              {membership.role === "admin" && (
                <div className="mt-4">
                  <SubscribeButton />
                </div>
              )}
              {membership.role !== "admin" && (
                <p className="mt-4 text-xs text-[var(--text-tertiary)]">
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
