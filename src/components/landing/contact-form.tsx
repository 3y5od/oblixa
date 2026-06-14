"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Loader2,
  Lock,
  Mail,
  Target,
  User,
} from "lucide-react";
import Link from "next/link";
import { mutateJson } from "@/lib/http/client-json";
import {
  FIELD_IDS,
  contractRanges,
  nextSteps,
  preferences,
  trackingMethods,
  validate,
  yesNoUnsure,
} from "@/components/landing/contact-form-data";
import { FormSection, OptionalTag, SegmentedField, SelectField, TextField } from "@/components/landing/contact-form-fields";
import { SubmittedState } from "@/components/landing/contact-form-submitted-state";

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    if (String(data.get("website") || "").length > 0) {
      setSubmitted(true);
      return;
    }

    const fieldErrors = validate(data);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const firstKey = Object.keys(FIELD_IDS).find((key) => fieldErrors[key]);
      if (firstKey) {
        const el = document.getElementById(FIELD_IDS[firstKey]);
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }
    setErrors({});

    const payload = Object.fromEntries(
      Array.from(data.entries()).map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.name,
      ])
    );
    setSubmitting(true);
    setError(null);
    try {
      const result = await mutateJson<null>("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Oblixa-Browser-Mutation": "same-origin",
        },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        throw new Error(
          result.message ||
            "We could not send your request. Try again, or email hello@oblixa.com."
        );
      }
      setSubmitted(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send your request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return <SubmittedState />;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate aria-busy={submitting}>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[10000px] h-0 w-0"
      />
      <input type="hidden" name="interested" value="request_access" />

      <div>
        <h2 className="text-[1.2rem] font-semibold tracking-tight text-[var(--text-primary)]">
          Request workspace access
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-secondary)]">
          Reviewed before account creation. No card required.
        </p>
        {/* Flat "what happens next" — no inner card (avoids card-within-card);
            numbers are inlined into the labels, not floating chips. */}
        <div className="mt-4">
          <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">What happens next</p>
          <ol className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-3">
            {nextSteps.map((step, i) => (
              <li key={step.label}>
                <p className="text-[12px] font-semibold leading-snug text-[var(--text-primary)]">
                  <span className="mr-1.5 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                    {i + 1}
                  </span>
                  {step.label}
                </p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-[var(--text-secondary)]">
                  {step.detail}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <fieldset disabled={submitting} className="space-y-5 border-0 p-0 disabled:opacity-60">
        <FormSection title="About you">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <TextField
              id="contact-name"
              name="name"
              label="Name"
              icon={User}
              autoComplete="name"
              error={errors.name}
              onClearError={() => clearError("name")}
            />
            <TextField
              id="contact-email"
              name="email"
              label="Work email"
              icon={Mail}
              type="email"
              autoComplete="email"
              mono
              error={errors.email}
              onClearError={() => clearError("email")}
            />
            <TextField
              id="contact-company"
              name="company"
              label="Company"
              icon={Building2}
              autoComplete="organization"
              error={errors.company}
              onClearError={() => clearError("company")}
            />
            <TextField
              id="contact-role"
              name="role"
              label="Role"
              icon={Briefcase}
              autoComplete="organization-title"
              hint="e.g. COO, ops, finance, legal"
              error={errors.role}
              onClearError={() => clearError("role")}
            />
          </div>
        </FormSection>

        <FormSection title="Current tracker">
          <div className="space-y-4">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <SelectField
                id="contact-contracts"
                name="contracts"
                label="Approx. signed contracts"
                options={contractRanges}
                error={errors.contracts}
                onClearError={() => clearError("contracts")}
              />
              <SelectField
                id="contact-tracking-method"
                name="trackingMethod"
                label="How tracked today"
                options={trackingMethods}
                error={errors.trackingMethod}
                onClearError={() => clearError("trackingMethod")}
              />
            </div>
            <SegmentedField
              name="hasTracker"
              label="Current tracker available"
              options={yesNoUnsure}
              optional
            />
            <SegmentedField
              name="redactedSample"
              label="Can share a redacted sample"
              options={yesNoUnsure}
              optional
            />
          </div>
        </FormSection>

        <FormSection title="Tracking fit">
          <div className="space-y-4">
            <TextField
              id="contact-pain"
              name="pain"
              label="Main tracking pain"
              icon={Target}
              placeholder="Renewals, owners, reports…"
              error={errors.pain}
              onClearError={() => clearError("pain")}
            />
            <SelectField
              id="contact-preference"
              name="preference"
              label="Follow-up preference"
              options={preferences}
              error={errors.preference}
              onClearError={() => clearError("preference")}
            />
            <div className="min-w-0">
              <label
                htmlFor="contact-message"
                className="ui-label-caps flex flex-wrap items-baseline gap-x-1.5"
              >
                <span>Message</span>
                <OptionalTag />
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={3}
                placeholder="Anything else about your contracts, timeline, or team."
                className="ui-input-compact w-full resize-y text-[13.5px]"
              />
            </div>
          </div>
        </FormSection>
      </fieldset>

      {error ? (
        <div role="alert" className="ui-alert-error flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div
        className="space-y-3 border-t pt-5"
        style={{ borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)" }}
      >
        <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
          <Lock className="mt-px h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
          <span>
            We use these details only to review workspace fit.{" "}
            <Link
              href="/privacy"
              className="ui-link rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Privacy
            </Link>
            .
          </span>
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="ui-btn-primary inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                strokeWidth={2}
                aria-hidden
              />
              Sending…
            </>
          ) : (
            <>
              Request access
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
