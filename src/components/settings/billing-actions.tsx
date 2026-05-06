"use client";

import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { LiveRegion } from "@/components/ui/live-region";
import { mutateJson } from "@/lib/http/client-json";
import { assignNavigableHref } from "@/lib/navigation/client-navigation";

export function SubscribeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const result = await mutateJson<{
        url?: string;
        error?: string;
      }>("/api/stripe/checkout", { method: "POST" });
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
    <div className="space-y-2">
      <LiveRegion message={loading ? "Redirecting to billing checkout." : error ?? undefined} politeness={error ? "assertive" : "polite"} />
      <AsyncActionButton
        onClick={handleCheckout}
        pending={loading}
        pendingLabel="Redirecting…"
        className="ui-btn-primary disabled:pointer-events-none disabled:opacity-45"
      >
        Subscribe now
      </AsyncActionButton>
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
