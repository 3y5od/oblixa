import { createAdminClient } from "@/lib/supabase/server";

const PAID_UP_STATUSES = new Set(["active", "trialing"]);

/**
 * Billing / Stripe enforcement is separate from workspace **product mode** (Core / Advanced /
 * Assurance in `organizations.v6_org_settings_json`). Product IA and navigation must not depend
 * on paid tier (product-surface policy §4.4); use plan checks only for optional commercial limits.
 */
/** When `REQUIRE_ACTIVE_SUBSCRIPTION=true`, mutations require a paid-up Stripe subscription on the org. */
export function isPlanEnforcementEnabled(): boolean {
  return process.env.REQUIRE_ACTIVE_SUBSCRIPTION === "true";
}

/**
 * True when the org has a subscription that is allowed to use paid features.
 * Requires `stripe_subscription_id` and a webhook-synced status of active or trialing.
 * Legacy rows with an id but no status column value are treated as active until the next webhook.
 */
export async function orgHasActivePlan(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string
): Promise<boolean> {
  const { data } = await admin
    .from("organizations")
    .select("stripe_subscription_id, stripe_subscription_status")
    .eq("id", orgId)
    .single();

  if (!data?.stripe_subscription_id) return false;

  const status = data.stripe_subscription_status;
  if (status == null || status === "") {
    return true;
  }

  return PAID_UP_STATUSES.has(status);
}
