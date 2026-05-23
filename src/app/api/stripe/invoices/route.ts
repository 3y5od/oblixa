import {
  jsonForbidden,
  jsonOk,
  jsonProblem,
  jsonRateLimited,
  jsonUnauthorized,
} from "@/lib/http/problem";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import {
  createClient,
  createAdminClient,
  getDeterministicMembership,
} from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";
import { isKillBilling, killSwitchJsonResponse } from "@/lib/security/kill-switches";

// SPEC: docs/billing-page-maximal-pass.md §3.27 — Stripe SDK is Node-only.
export const runtime = "nodejs";

const ROUTE = "/api/stripe/invoices";

export type BillingInvoiceLine = {
  description: string;
  amountMinor: number;
};

export type BillingInvoice = {
  id: string;
  number: string | null;
  created: number;
  amountDueMinor: number;
  amountPaidMinor: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  attemptCount: number;
  refundedAmountMinor: number;
  lines: BillingInvoiceLine[];
};

// SPEC: §3.2 — GET returns up to 5 recent invoices for the workspace.
export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized(ROUTE);

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return jsonProblem(400, {
      error: "No organization membership",
      code: "organization_membership_missing",
      diagnostic_id: "stripe_invoices_membership_missing",
      route: ROUTE,
    });
  }
  if (membership.role !== "admin") return jsonForbidden(ROUTE);

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(
    `stripe-invoices:${user.id}:${ip}`,
    RATE_LIMITS.stripeCheckoutSession
  );
  if (!rl.ok) return jsonRateLimited(rl.retryAfterMs, ROUTE);

  if (isKillBilling()) return killSwitchJsonResponse("billing");

  const { data: orgRow } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", membership.organization_id)
    .single();

  if (!orgRow?.stripe_customer_id) {
    const res = jsonOk({ invoices: [] satisfies BillingInvoice[] });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  }

  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) {
    return jsonProblem(503, {
      error: "Billing provider is not configured",
      code: "dependency_blocked",
      diagnostic_id: "stripe_invoices_provider_missing",
      route: ROUTE,
    });
  }

  try {
    const list = await stripeClient.stripe.invoices.list({
      customer: orgRow.stripe_customer_id,
      limit: 5,
      expand: ["data.charge"],
    });

    const invoices: BillingInvoice[] = await Promise.all(
      list.data.map(async (inv) => {
        // SPEC: §9.19 — refunds are separate Refund objects associated
        // with the Charge. List them when there's a charge.
        // Note: Stripe SDK 22.x deprecated Invoice.charge from public types;
        // it's still present at runtime — narrow via unknown cast.
        let refundedAmountMinor = 0;
        const invAsAny = inv as unknown as {
          charge?: string | { id?: string } | null;
        };
        const chargeId =
          typeof invAsAny.charge === "string"
            ? invAsAny.charge
            : invAsAny.charge && "id" in invAsAny.charge
              ? invAsAny.charge.id ?? null
              : null;
        if (chargeId) {
          try {
            const refunds = await stripeClient.stripe.refunds.list({
              charge: chargeId,
              limit: 10,
            });
            refundedAmountMinor = refunds.data.reduce(
              (acc, r) => acc + (r.amount ?? 0),
              0
            );
          } catch {
            // Best-effort: omit refund info on failure
          }
        }

        return {
          id: inv.id ?? "",
          number: inv.number ?? null,
          created: inv.created,
          amountDueMinor: inv.amount_due,
          amountPaidMinor: inv.amount_paid,
          currency: inv.currency,
          status: inv.status ?? "unknown",
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          invoicePdf: inv.invoice_pdf ?? null,
          attemptCount: inv.attempt_count,
          refundedAmountMinor,
          lines: (inv.lines?.data ?? []).map((l) => ({
            description: l.description ?? "Subscription",
            amountMinor: l.amount,
          })),
        };
      })
    );

    const res = jsonOk({ invoices });
    // SPEC: §3.16 + §3.26
    res.headers.set("Cache-Control", "no-store, max-age=0");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    return res;
  } catch (err) {
    const stripeErr = err as {
      requestId?: string;
      code?: string;
      type?: string;
      statusCode?: number;
    };
    console.error("[stripe/invoices] list:", err instanceof Error ? err.message : err, {
      requestId: stripeErr.requestId,
      code: stripeErr.code,
      type: stripeErr.type,
    });
    return jsonProblem(502, {
      error: "Could not load invoices",
      code: "invoices_load_failed",
      diagnostic_id: "stripe_invoices_load_failed",
      route: ROUTE,
    });
  }
}
