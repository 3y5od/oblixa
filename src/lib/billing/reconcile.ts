import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// SPEC: docs/billing-page-maximal-pass.md §15.10 — DB-to-Stripe state
// reconciliation. Cached subscription status can drift from Stripe's
// truth when webhooks drop or arrive out of order. Detect, write
// through, and log so SRE can spot systematic drift.

export async function reconcileSubscriptionState(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    cachedStatus: string | null;
    liveStatus: string;
  }
): Promise<{ drifted: boolean }> {
  const { organizationId, cachedStatus, liveStatus } = input;
  if (cachedStatus === liveStatus) return { drifted: false };

  // Write through.
  try {
    await admin
      .from("organizations")
      .update({ stripe_subscription_status: liveStatus })
      .eq("id", organizationId);
  } catch (err) {
    console.error("[billing/reconcile] write-through failed:", err);
  }

  // Log drift event — best-effort.
  console.warn(
    "[billing/reconcile] drift detected:",
    JSON.stringify({
      organizationId,
      cachedStatus,
      liveStatus,
      occurredAt: new Date().toISOString(),
    })
  );

  return { drifted: true };
}
