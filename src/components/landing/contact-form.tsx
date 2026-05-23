"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { mutateJson } from "@/lib/http/client-json";

type Tone = "cool" | "warm" | "success";

const TONE_COLOR: Record<Tone, string> = {
  cool: "var(--accent-strong)",
  warm: "var(--accent-warm, var(--accent))",
  success: "var(--success-ink)",
};

const interestedOptions = [
  { value: "core", label: "Core plan" },
  { value: "founding_customer", label: "Founding Customer offer" },
  { value: "guided_pilot", label: "Guided pilot" },
  { value: "larger_team", label: "Larger-team workflows" },
  { value: "custom", label: "Custom workflows" },
  { value: "dpa", label: "Data Processing Addendum (DPA)" },
  { value: "general", label: "General inquiry" },
] as const;

type InterestedValue = (typeof interestedOptions)[number]["value"];

const contractsRanges = [
  { value: "<50", label: "Under 50" },
  { value: "50-200", label: "50–200" },
  { value: "200-500", label: "200–500" },
  { value: "500-2000", label: "500–2,000" },
  { value: "2000+", label: "Over 2,000" },
] as const;

const interestedValues = new Set<string>(interestedOptions.map((o) => o.value));

function isInterested(v: string): v is InterestedValue {
  return interestedValues.has(v);
}

function painPrefillFor(v: InterestedValue): string {
  if (v === "dpa") return "Need a Data Processing Addendum";
  if (v === "founding_customer") return "Interested in the Founding Customer offer";
  if (v === "larger_team") return "Need a larger plan than Core's 10 seats";
  if (v === "custom") return "Custom workflows or SSO";
  return "";
}

function FieldGroup({
  heading,
  hint,
  tone,
  children,
}: {
  heading: string;
  hint?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  const color = tone ? TONE_COLOR[tone] : "var(--accent-strong)";
  const headingId = `fg-${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-[13px] font-bold uppercase leading-none tracking-[0.2em] sm:text-[13.5px]"
        style={{ color }}
      >
        {heading}
      </h3>
      {hint ? (
        <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{hint}</p>
      ) : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function CustomSelect({
  id,
  name,
  required,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  name: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="ui-input-compact flex h-10 w-full appearance-none items-center justify-between text-left text-[13.5px] disabled:cursor-not-allowed [background-image:none]"
      >
        <span
          className={
            selected
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-tertiary)]"
          }
        >
          {selected?.label ?? placeholder ?? "Select"}
        </span>
        <ChevronDown
          aria-hidden
          strokeWidth={1.85}
          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-lg border py-1 shadow-lg"
          style={{
            borderColor: "color-mix(in oklab, var(--border-subtle) 85%, transparent)",
            background: "color-mix(in oklab, var(--surface-raised) 96%, white)",
            boxShadow: "0 12px 28px -12px color-mix(in oklab, var(--accent-strong) 25%, transparent), 0 4px 12px -4px rgba(0,0,0,0.4)",
          }}
        >
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className={`cursor-pointer px-3 py-2 text-[13.5px] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,transparent)] hover:text-[var(--text-primary)] ${
                  isSelected
                    ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,transparent)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ContactFormSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-32 rounded animate-pulse motion-reduce:animate-none bg-[color:color-mix(in_oklab,var(--text-tertiary)_22%,transparent)]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 rounded-lg animate-pulse motion-reduce:animate-none bg-[color:color-mix(in_oklab,var(--surface)_70%,transparent)]" />
            <div className="h-10 rounded-lg animate-pulse motion-reduce:animate-none bg-[color:color-mix(in_oklab,var(--surface)_70%,transparent)]" />
          </div>
        </div>
      ))}
      <div className="h-10 w-44 rounded-lg animate-pulse motion-reduce:animate-none bg-[color:color-mix(in_oklab,var(--surface)_70%,transparent)]" />
    </div>
  );
}

function SubmittedState() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    el.focus();
    if (typeof window !== "undefined") {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
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
        className="landing-corner-ring"
        style={{ top: "-2rem", right: "-2rem", width: "8rem", height: "8rem" }}
      />
      <div className="relative">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border motion-reduce:animate-none"
          style={{
            borderColor: "color-mix(in oklab, var(--success-ink) 22%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--success-soft) 28%, var(--surface-raised))",
            color: "var(--success-ink)",
            animation: "contact-success-medallion 240ms ease-out 1",
          }}
        >
          <CheckCircle2 className="h-5 w-5" strokeWidth={1.85} />
        </span>
        <h2
          ref={headingRef}
          id="contact-success-h"
          tabIndex={-1}
          className="mt-3 text-[1.25rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] outline-none"
        >
          Message received.
        </h2>
        <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--success-ink)" }}
          />
          What happens next
        </p>
        <ul className="mt-3 space-y-2 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success-ink)]"
              strokeWidth={2}
              aria-hidden
            />
            Within 1 business day: a team member will email you back.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success-ink)]"
              strokeWidth={2}
              aria-hidden
            />
            Optional: book a 30-minute setup call at your convenience.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success-ink)]"
              strokeWidth={2}
              aria-hidden
            />
            While you wait:{" "}
            <Link
              href="/security"
              className="ui-link font-medium text-[var(--text-primary)]"
            >
              review the security practices
            </Link>
            {" "}or{" "}
            <Link
              href="/pricing"
              className="ui-link font-medium text-[var(--text-primary)]"
            >
              revisit pricing
            </Link>
            .
          </li>
        </ul>
        <div className="mt-5">
          <Link
            href="/security"
            className="ui-link inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Review security practices
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ContactFormInner() {
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialInterested: InterestedValue = (() => {
    const raw = params?.get("interested")?.trim() ?? "";
    return isInterested(raw) ? raw : "core";
  })();
  const [interested, setInterested] = useState<InterestedValue>(initialInterested);
  const [contracts, setContracts] = useState<string>("");
  const [pain, setPain] = useState<string>(painPrefillFor(initialInterested));

  useEffect(() => {
    setPain((prev) => {
      const prefill = painPrefillFor(interested);
      const previousPrefills = interestedOptions
        .map((o) => painPrefillFor(o.value))
        .filter(Boolean);
      if (prev === "" || previousPrefills.includes(prev)) return prefill;
      return prev;
    });
  }, [interested]);

  // On submit failure, scroll the error card into view so the user notices it
  // even if their viewport has scrolled past the bottom of the form.
  useEffect(() => {
    if (!error || typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[role="alert"]');
      el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    });
  }, [error]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    if (String(data.get("website") || "").length > 0) {
      // Honeypot — silently succeed.
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        throw new Error(
          result.message ||
            "We could not deliver your message. Please try again or email hello@oblixa.com."
        );
      }
      setSubmitted(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not deliver your message.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <SubmittedState />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-0 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]"
      noValidate
      aria-busy={submitting}
    >
      {/* Honeypot — invisible to humans, often filled by bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[10000px] h-0 w-0"
      />

      <fieldset disabled={submitting} className="border-0 p-0 disabled:opacity-60">
        <div className="pb-6">
          <FieldGroup heading="About you" tone="cool">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="ui-label-caps">Name</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  aria-required="true"
                  autoComplete="name"
                  className="ui-input-compact h-10 w-full text-[13.5px] disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="ui-label-caps">Work email</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  aria-required="true"
                  autoComplete="email"
                  className="ui-input-compact h-10 w-full text-[13.5px] disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </FieldGroup>
        </div>

        <div className="py-6">
          <FieldGroup heading="About your company" tone="warm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-company" className="ui-label-caps">Company</label>
                <input
                  id="contact-company"
                  name="company"
                  type="text"
                  required
                  aria-required="true"
                  autoComplete="organization"
                  className="ui-input-compact h-10 w-full text-[13.5px] disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="contact-role" className="ui-label-caps">Role</label>
                <input
                  id="contact-role"
                  name="role"
                  type="text"
                  required
                  aria-required="true"
                  autoComplete="organization-title"
                  placeholder="e.g. COO, legal ops, founder"
                  className="ui-input-compact h-10 w-full text-[13.5px] disabled:cursor-not-allowed"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="contact-contracts" className="ui-label-caps">
                  Approximate number of contracts
                </label>
                <CustomSelect
                  id="contact-contracts"
                  name="contracts"
                  required
                  value={contracts}
                  onChange={setContracts}
                  options={contractsRanges}
                  placeholder="Pick a range"
                />
              </div>
            </div>
          </FieldGroup>
        </div>

        <div className="pt-6">
          <FieldGroup heading="About your need" tone="success">
            <div>
              <label htmlFor="contact-interested" className="ui-label-caps">
                Interested in
              </label>
              <CustomSelect
                id="contact-interested"
                name="interested"
                required
                value={interested}
                onChange={(v) => {
                  if (isInterested(v)) setInterested(v);
                }}
                options={interestedOptions}
              />
            </div>
            <div>
              <label htmlFor="contact-pain" className="ui-label-caps">Main pain</label>
              <input
                id="contact-pain"
                name="pain"
                type="text"
                value={pain}
                onChange={(e) => setPain(e.currentTarget.value)}
                placeholder="e.g. Renewal dates are easy to miss. Obligations are buried in PDFs."
                className="ui-input-compact h-10 w-full text-[13.5px] disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="ui-label-caps">
                Message (optional)
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                className="ui-input-compact w-full resize-y text-[13.5px] disabled:cursor-not-allowed"
              />
            </div>
          </FieldGroup>
        </div>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-lg border p-3 text-[12.5px]"
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

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="ui-btn-primary inline-flex w-full min-w-[180px] items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden />
              Sending…
            </>
          ) : (
            <>
              Book setup call
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function ContactForm() {
  return (
    <Suspense fallback={<ContactFormSkeleton />}>
      <ContactFormInner />
    </Suspense>
  );
}
