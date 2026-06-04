"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  Target,
  User,
  type LucideIcon,
} from "lucide-react";
import { mutateJson } from "@/lib/http/client-json";
import { UiSelect } from "@/components/ui/ui-select";

const contractRanges = [
  { value: "under_20", label: "Under 20" },
  { value: "20_50", label: "20-50" },
  { value: "50_200", label: "50-200" },
  { value: "200_plus", label: "More than 200" },
] as const;

const trackingMethods = [
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "shared_folder", label: "Shared folder" },
  { value: "email_calendar", label: "Email or calendar reminders" },
  { value: "memory", label: "Someone's memory" },
  { value: "mixed", label: "A mix of tools" },
  { value: "other", label: "Other" },
] as const;

const yesNoUnsure = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure yet" },
] as const;

const preferences = [
  { value: "async", label: "Async questions first" },
  { value: "call", label: "Short call if there is a fit" },
  { value: "either", label: "Either is fine" },
] as const;

/**
 * Three structured "what happens next" steps — number medallion + short label +
 * one-line detail (§10.7: structured over prose). Step 2's detail keeps the
 * "If there is a fit" phrase that the marketing voice-sweep pins to this file.
 */
const nextSteps = [
  {
    label: "Reviewed for fit",
    detail: "Each request is reviewed against early-access fit.",
  },
  {
    label: "We follow up",
    detail: "If there is a fit, we follow up with a few questions.",
  },
  {
    label: "Invite to evaluate",
    detail: "If it still fits, you get an invite to a small evaluation.",
  },
] as const;

function SubmittedState() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="landing-card-premium relative overflow-hidden rounded-2xl border p-6 sm:p-8"
      style={{
        borderColor: "color-mix(in oklab, var(--success-ink) 22%, var(--border-subtle))",
        background: "color-mix(in oklab, var(--success-soft) 20%, var(--surface-raised))",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
        style={{
          borderColor: "color-mix(in oklab, var(--success-ink) 22%, var(--border-subtle))",
          background: "color-mix(in oklab, var(--success-soft) 28%, var(--surface-raised))",
          color: "var(--success-ink)",
        }}
      >
        <CheckCircle2 className="h-5 w-5" strokeWidth={1.85} />
      </span>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 text-[1.25rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] outline-none"
      >
        Request received.
      </h2>
      <p className="mt-3 text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
        Thanks. If there is a fit, we will follow up with a few questions about your
        current tracker and whether a small evaluation makes sense.
      </p>
      <p className="mt-3 text-[12.5px] leading-[1.6] text-[var(--text-tertiary)]">
        Submitting a request does not guarantee acceptance, a workspace, or a reply time.
      </p>
    </div>
  );
}

/** Small bordered caps chip marking a non-required field (§7.4 inline tag). */
function OptionalTag() {
  return (
    <span
      className="ml-1.5 inline-flex items-center rounded-[5px] border px-1 py-px align-middle text-[8.5px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--text-tertiary)]"
      style={{ borderColor: "var(--border-card)" }}
    >
      Optional
    </span>
  );
}

/** Icon-led text input (§7.2). Selects keep the trailing chevron instead, so
 *  the two control types stay visually distinct within the same form. */
function TextField({
  id,
  name,
  label,
  icon: Icon,
  type = "text",
  autoComplete,
  placeholder,
  mono = false,
}: {
  id: string;
  name: string;
  label: string;
  icon: LucideIcon;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="ui-label-caps">
        {label}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
        </span>
        <input
          id={id}
          name={name}
          type={type}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`ui-input-compact h-10 w-full pl-9 text-[13.5px]${mono ? " font-mono" : ""}`}
        />
      </div>
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  options,
  required = true,
  optional = false,
}: {
  id: string;
  name: string;
  label: string;
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div>
      <label id={`${id}-label`} htmlFor={id} className="ui-label-caps">
        {label}
        {optional ? <OptionalTag /> : null}
      </label>
      <UiSelect
        id={id}
        name={name}
        ariaLabelledBy={`${id}-label`}
        required={required}
        options={options}
        placeholder="Select"
        portal
        menuWidth="trigger"
        className="w-full"
        buttonClassName="h-10 text-[13.5px]"
      />
    </div>
  );
}

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    if (String(data.get("website") || "").length > 0) {
      setSubmitted(true);
      return;
    }
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
      <input type="hidden" name="interested" value="early_access" />

      <fieldset disabled={submitting} className="space-y-5 border-0 p-0 disabled:opacity-60">
        <div>
          <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">
            What happens next
          </p>
          <ol className="mt-3 grid gap-2.5">
            {nextSteps.map((step, i) => (
              <li key={step.label} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] tabular-nums"
                  style={{
                    borderColor: "color-mix(in oklab, var(--accent) 22%, var(--border-subtle))",
                    background: "color-mix(in oklab, var(--accent-soft) 30%, var(--surface-raised))",
                    color: "var(--accent-strong)",
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold leading-snug text-[var(--text-primary)]">
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
            <Info className="mt-px h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
            <span>
              Not every request becomes a workspace, and there is no guaranteed reply time.
            </span>
          </p>
        </div>

        <section
          className="border-t pt-5"
          style={{ borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)" }}
        >
          <h3 className="ui-caps-1 text-[11px] leading-none text-[var(--text-tertiary)]">
            About you
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField id="contact-name" name="name" label="Name" icon={User} autoComplete="name" />
            <TextField
              id="contact-email"
              name="email"
              label="Work email"
              icon={Mail}
              type="email"
              autoComplete="email"
              mono
            />
            <TextField
              id="contact-company"
              name="company"
              label="Company"
              icon={Building2}
              autoComplete="organization"
            />
            <TextField
              id="contact-role"
              name="role"
              label="Role"
              icon={Briefcase}
              autoComplete="organization-title"
              placeholder="Founder, COO, ops, finance"
            />
          </div>
        </section>

        <section
          className="border-t pt-5"
          style={{ borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)" }}
        >
          <h3 className="ui-caps-1 text-[11px] leading-none text-[var(--text-tertiary)]">
            Current tracker
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField id="contact-contracts" name="contracts" label="Approx. signed contracts" options={contractRanges} />
            <SelectField id="contact-tracking-method" name="trackingMethod" label="How tracked today" options={trackingMethods} />
            <SelectField id="contact-has-tracker" name="hasTracker" label="Current tracker available" options={yesNoUnsure} required={false} optional />
            <SelectField id="contact-redacted-sample" name="redactedSample" label="Can share a redacted sample" options={yesNoUnsure} required={false} optional />
          </div>
        </section>

        <section
          className="border-t pt-5"
          style={{ borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)" }}
        >
          <h3 className="ui-caps-1 text-[11px] leading-none text-[var(--text-tertiary)]">
            Evaluation fit
          </h3>
          <div className="mt-4 space-y-4">
            <TextField
              id="contact-pain"
              name="pain"
              label="Main tracking pain"
              icon={Target}
              placeholder="Renewals, owners, reports…"
            />
            <SelectField id="contact-preference" name="preference" label="Follow-up preference" options={preferences} />
            <div>
              <label htmlFor="contact-message" className="ui-label-caps">
                Message
                <OptionalTag />
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={3}
                className="ui-input-compact w-full resize-y text-[13.5px]"
              />
            </div>
          </div>
        </section>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border p-3 text-[12.5px]"
          style={{
            borderColor: "color-mix(in oklab, var(--danger-ink) 28%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--danger-soft) 22%, var(--surface-raised))",
            color: "var(--danger-ink)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="font-medium">{error}</span>
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center justify-start gap-3 border-t pt-5"
        style={{ borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)" }}
      >
        <button
          type="submit"
          disabled={submitting}
          className="ui-btn-primary inline-flex w-full min-w-[180px] items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden />
              Sending…
            </>
          ) : (
            <>
              Request early access
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
