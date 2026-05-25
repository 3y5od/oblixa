import {
  jsonForbidden,
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
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { getStripeClient } from "@/lib/stripe";

// SPEC: docs/billing-page-refinement-pass.md §3.19 — invoice PDF
// freshness proxy. Stripe `invoice_pdf` URLs are short-lived; older
// invoice rows can 404 on direct click. This route re-retrieves the
// invoice server-side and 302s to the current PDF URL.
export const runtime = "nodejs";

const ROUTE = "/api/stripe/invoices/[id]/pdf";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], ROUTE);
  if (routeParamRejection) return routeParamRejection;

  if (!id || !id.startsWith("in_")) {
    return jsonProblem(400, {
      error: "Invalid invoice id",
      code: "invalid_invoice_id",
      diagnostic_id: "stripe_invoices_pdf_invalid_id",
      route: ROUTE,
    });
  }

  const supabase = await createClient();
  const admin = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized(ROUTE);

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return jsonProblem(400, {
      error: "No organization membership",
      code: "organization_membership_missing",
      diagnostic_id: "stripe_invoices_pdf_membership_missing",
      route: ROUTE,
    });
  }
  if (membership.role !== "admin") return jsonForbidden(ROUTE);

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(
    `stripe-invoice-pdf:${user.id}:${ip}`,
    RATE_LIMITS.stripeCheckoutSession
  );
  if (!rl.ok) return jsonRateLimited(rl.retryAfterMs, ROUTE);

  const { data: orgRow } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", membership.organization_id)
    .single();
  if (!orgRow?.stripe_customer_id) return jsonForbidden(ROUTE);

  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) {
    return jsonProblem(503, {
      error: "Billing provider is not configured",
      code: "dependency_blocked",
      diagnostic_id: "stripe_invoices_pdf_provider_missing",
      route: ROUTE,
    });
  }

  try {
    const invoice = await stripeClient.stripe.invoices.retrieve(id);
    // Ownership check — ensure the invoice belongs to this workspace's
    // Stripe customer (defense in depth against parameter tampering).
    const invoiceCustomer =
      typeof invoice.customer === "string"
        ? invoice.customer
        : (invoice.customer as { id?: string } | null)?.id ?? null;
    if (invoiceCustomer !== orgRow.stripe_customer_id) {
      return jsonForbidden(ROUTE);
    }
    if (!invoice.invoice_pdf) {
      return jsonProblem(404, {
        error: "PDF not available",
        code: "invoice_pdf_missing",
        diagnostic_id: "stripe_invoices_pdf_missing",
        route: ROUTE,
      });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: invoice.invoice_pdf,
        "Cache-Control": "no-store, max-age=0",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch (err) {
    const stripeErr = err as { requestId?: string; code?: string };
    console.error(
      "[stripe/invoices/pdf]",
      err instanceof Error ? err.message : err,
      { requestId: stripeErr.requestId, code: stripeErr.code }
    );
    return jsonProblem(502, {
      error: "Could not retrieve invoice",
      code: "invoice_retrieve_failed",
      diagnostic_id: "stripe_invoices_pdf_retrieve_failed",
      route: ROUTE,
    });
  }
}
