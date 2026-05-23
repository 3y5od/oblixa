"use client";

import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { LiveRegion } from "@/components/ui/live-region";
import { mutateJson } from "@/lib/http/client-json";
import { assignNavigableHref } from "@/lib/navigation/client-navigation";

/**
 * Checkout button that posts to `/api/stripe/checkout`.
 *
 * SPEC: docs/billing-page-maximal-pass.md §1.2 (monthly variant gating),
 * §3.9 (variant-aware server action), §9.11 (founding-customer variant),
 * §1.27 (canceled → reactivate uses same flow), §1.28 (incomplete → resume).
 */
export function SubscribeButton({
  label = "Subscribe now",
  className = "ui-btn-primary disabled:pointer-events-none disabled:opacity-45",
  variant,
  founding,
}: {
  label?: string;
  className?: string;
  variant?: "annual" | "monthly";
  founding?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (variant) body.variant = variant;
      if (founding) body.founding = true;
      const result = await mutateJson<{
        url?: string;
        error?: string;
      }>("/api/stripe/checkout", {
        method: "POST",
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      });
      if (!result.ok) {
        setError(result.message || "Could not start checkout");
        return;
      }
      if (result.data.url) {
        if (!assignNavigableHref(result.data.url)) {
          setError("Could not open checkout");
        }
      } else {
        setError(result.data.error || "Could not start checkout");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <LiveRegion message={loading ? "Redirecting to billing checkout." : error ?? undefined} politeness={error ? "assertive" : "polite"} />
      {/* §12.10 — noscript form-action fallback. When JS is disabled,
          the AsyncActionButton renders as a regular button inside this
          form, which posts to /api/stripe/checkout server-side. */}
      <form action="/api/stripe/checkout" method="POST">
        {variant ? (
          <input type="hidden" name="variant" value={variant} />
        ) : null}
        {founding ? (
          <input type="hidden" name="founding" value="true" />
        ) : null}
        <AsyncActionButton
          onClick={handleCheckout}
          pending={loading}
          pendingLabel="Redirecting…"
          className={className}
        >
          {label}
        </AsyncActionButton>
      </form>
      <InlineMutationStatus message={error} variant="error" className="text-sm" />
    </div>
  );
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePortal() {
    setLoading(true);
    setError(null);
    try {
      const result = await mutateJson<{
        url?: string;
        error?: string;
      }>("/api/stripe/portal", { method: "POST" });
      if (!result.ok) {
        setError(result.message || "Could not open billing portal");
        return;
      }
      if (result.data.url) {
        if (!assignNavigableHref(result.data.url)) {
          setError("Could not open billing portal");
        }
      } else {
        setError(result.data.error || "Could not open billing portal");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <LiveRegion message={loading ? "Opening billing portal." : error ?? undefined} politeness={error ? "assertive" : "polite"} />
      <AsyncActionButton
        onClick={handlePortal}
        pending={loading}
        pendingLabel="Loading…"
        className="ui-btn-secondary px-4 py-2 disabled:pointer-events-none disabled:opacity-45"
      >
        Manage subscription
      </AsyncActionButton>
      <InlineMutationStatus message={error} variant="error" className="text-sm" />
    </div>
  );
}
