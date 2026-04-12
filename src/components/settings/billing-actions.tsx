"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { readApiJson } from "@/lib/parse-api-response";

export function SubscribeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const { data, isJson, rawPreview } = await readApiJson<{
        url?: string;
        error?: string;
      }>(res);
      if (!isJson) {
        setError(
          res.ok
            ? "Unexpected response from billing. Please try again."
            : `Billing error (${res.status}). ${rawPreview.slice(0, 160)}`
        );
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not start checkout");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="ui-btn-primary disabled:pointer-events-none disabled:opacity-45"
        aria-busy={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Redirecting…
          </span>
        ) : (
          "Subscribe now"
        )}
      </button>
      {error ? <p className="ui-alert-error text-sm">{error}</p> : null}
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
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const { data, isJson, rawPreview } = await readApiJson<{
        url?: string;
        error?: string;
      }>(res);
      if (!isJson) {
        setError(
          res.ok
            ? "Unexpected response from billing. Please try again."
            : `Billing error (${res.status}). ${rawPreview.slice(0, 160)}`
        );
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not open billing portal");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePortal}
        disabled={loading}
        className="ui-btn-secondary px-4 py-2 disabled:pointer-events-none disabled:opacity-45"
        aria-busy={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Loading…
          </span>
        ) : (
          "Manage subscription"
        )}
      </button>
      {error ? <p className="ui-alert-error text-sm">{error}</p> : null}
    </div>
  );
}
