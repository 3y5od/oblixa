"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Target,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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

/** Bounded yes/no/unsure answers — a segmented radio control rather than a
 *  dropdown so a one-tap answer never opens a menu. */
const yesNoUnsure = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
] as const;

const preferences = [
  { value: "async", label: "Async questions first" },
  { value: "call", label: "Short call if there is a fit" },
  { value: "either", label: "Either is fine" },
] as const;

/**
 * Three structured "what happens next" steps. Step 2's detail keeps the
 * "If there is a fit" phrase pinned by the marketing voice-sweep. Step 3 avoids
 * "evaluation"/"trial" language per the release-state posture.
 */
const nextSteps = [
  { label: "Reviewed for fit", detail: "Reviewed against workspace fit." },
  { label: "We follow up", detail: "If there is a fit, we follow up with a few questions." },
  { label: "Invite to start", detail: "An invite to start a bounded first workspace." },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Required-field ids in tab order — drives focus-first-error on submit. */
const FIELD_IDS: Record<string, string> = {
  name: "contact-name",
  email: "contact-email",
  company: "contact-company",
  role: "contact-role",
  contracts: "contact-contracts",
  trackingMethod: "contact-tracking-method",
  pain: "contact-pain",
  preference: "contact-preference",
};

function validate(data: FormData): Record<string, string> {
  const errs: Record<string, string> = {};
  const required = (key: string, msg: string) => {
    if (!String(data.get(key) ?? "").trim()) errs[key] = msg;
  };
  required("name", "Enter your name.");
  const email = String(data.get("email") ?? "").trim();
  if (!email) errs.email = "Enter your work email.";
  else if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address.";
  required("company", "Enter your company.");
  required("role", "Enter your role.");
  required("contracts", "Select a range.");
  required("trackingMethod", "Select how you track today.");
  required("pain", "Describe the main tracking pain.");
  required("preference", "Choose a follow-up preference.");
  return errs;
}

/** Inline success state — content inside the page's form card (no nested card). */
function SubmittedState() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-8 text-center sm:py-12"
    >
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{
          borderColor: "color-mix(in oklab, var(--success-ink) 24%, var(--border-subtle))",
          background: "color-mix(in oklab, var(--success-soft) 30%, var(--surface-raised))",
          color: "var(--success-ink)",
        }}
      >
        <CheckCircle2 className="h-6 w-6" strokeWidth={1.85} />
      </span>
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-[1.25rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] outline-none"
        >
          Request received.
        </h2>
        <p className="mx-auto mt-2.5 max-w-[42ch] text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
          Thanks. If there is a fit, we will follow up with a few questions about your current
          tracker and whether a bounded first workspace makes sense.
        </p>
        <p className="mx-auto mt-2.5 max-w-[42ch] text-[12.5px] leading-[1.55] text-[var(--text-tertiary)]">
          Submitting a request does not create an account or charge a card. Not every request
          becomes a workspace, and reply times vary.
        </p>
      </div>
    </div>
  );
}

/** Lightweight, borderless optional marker — caps, tertiary, never a cramped pill. */
function OptionalTag() {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
      Optional
    </span>
  );
}

/** Caps section heading on a hairline — one consistent group rhythm. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="border-t pt-5"
      style={{ borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)" }}
    >
      <h3 className="ui-caps-1 text-[11px] leading-none text-[var(--text-tertiary)]">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Error line with a reserved min-height so showing/clearing it never shifts
 *  layout (no jump on submit). */
function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="mt-1 min-h-[0.9rem] text-[11px] leading-snug text-[var(--danger-ink)]">
      {message}
    </p>
  );
}

/** Icon-led text input (§7.2) with inline error + example hint folded into the label. */
function TextField({
  id,
  name,
  label,
  icon: Icon,
  type = "text",
  autoComplete,
  placeholder,
  mono = false,
  hint,
  error,
  onClearError,
}: {
  id: string;
  name: string;
  label: string;
  icon: LucideIcon;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  mono?: boolean;
  hint?: string;
  error?: string;
  onClearError?: () => void;
}) {
  const errId = `${id}-err`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="ui-label-caps flex flex-wrap items-baseline gap-x-1.5">
        <span>{label}</span>
        {hint ? (
          <span className="text-[9.5px] font-medium normal-case tracking-normal text-[var(--text-tertiary)]">
            {hint}
          </span>
        ) : null}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <input
          id={id}
          name={name}
          type={type}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onInput={onClearError}
          className={`ui-input-compact h-10 w-full pl-9 text-[13.5px]${mono ? " font-mono" : ""}`}
          style={
            error
              ? { borderColor: "color-mix(in oklab, var(--danger-ink) 48%, var(--border-subtle))" }
              : undefined
          }
        />
      </div>
      <FieldError id={errId} message={error} />
    </div>
  );
}

/** Custom combobox (§7.3) for multi-option enumerations, with inline error. */
function SelectField({
  id,
  name,
  label,
  options,
  error,
  onClearError,
}: {
  id: string;
  name: string;
  label: string;
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  error?: string;
  onClearError?: () => void;
}) {
  return (
    <div className="min-w-0">
      <label id={`${id}-label`} htmlFor={id} className="ui-label-caps">
        {label}
      </label>
      <UiSelect
        id={id}
        name={name}
        ariaLabelledBy={`${id}-label`}
        required
        options={options}
        placeholder="Select"
        portal
        menuWidth="trigger"
        className="w-full"
        buttonClassName="h-10 text-[13.5px]"
        onChange={onClearError}
      />
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

/** Segmented radio control for short bounded answers (yes/no/unsure). Native
 *  radios keep group keyboard nav, checked state, and form submission; the
 *  overlay input stays pointer/keyboard reachable while the styled segment shows
 *  a pronounced selected/hover/focus state. The track is content-width so the
 *  field's label has the full row and never wraps its "optional" tag. */
function SegmentedField({
  name,
  label,
  options,
  optional = false,
}: {
  name: string;
  label: string;
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  optional?: boolean;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="ui-label-caps flex flex-wrap items-baseline gap-x-1.5 p-0">
        <span>{label}</span>
        {optional ? <OptionalTag /> : null}
      </legend>
      <div
        className="inline-flex max-w-full items-stretch gap-1 rounded-xl border p-1"
        style={{
          borderColor: "var(--border-card)",
          background: "color-mix(in oklab, var(--surface-muted) 50%, var(--surface-raised))",
        }}
      >
        {options.map((opt) => (
          <label key={opt.value} className="relative">
            <input
              type="radio"
              name={name}
              value={opt.value}
              aria-label={opt.label}
              className="peer absolute inset-0 z-10 m-0 cursor-pointer appearance-none rounded-lg opacity-0 focus-visible:outline-none"
            />
            <span className="pointer-events-none flex h-9 min-w-[3.75rem] items-center justify-center rounded-lg px-3.5 text-center text-[12.5px] font-medium text-[var(--text-secondary)] ring-1 ring-transparent transition-colors peer-hover:bg-[color:color-mix(in_oklab,var(--surface-raised)_72%,transparent)] peer-hover:text-[var(--text-primary)] peer-checked:bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,var(--surface-raised))] peer-checked:font-semibold peer-checked:text-[var(--accent-strong)] peer-checked:shadow-[var(--shadow-1)] peer-checked:ring-[color:color-mix(in_oklab,var(--accent)_30%,transparent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)]">
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

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
