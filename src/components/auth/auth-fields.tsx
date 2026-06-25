"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, KeyRound, Mail, User, Users, type LucideIcon } from "lucide-react";
import type { AuthMode } from "./auth-config";

/** Reserved message slot — holds an error or requirement line at a fixed min
 *  height so the card rhythm is stable whether or not a message is showing. */
function MessageSlot({
  errorId,
  error,
  reqId,
  requirement,
}: {
  errorId: string;
  error?: string;
  reqId?: string;
  requirement?: string;
}) {
  return (
    <div className="mt-1.5 min-h-[1.05rem]">
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-[11.5px] leading-snug text-[var(--danger-ink)]">
          <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </p>
      ) : requirement ? (
        <p id={reqId} className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          {requirement}
        </p>
      ) : null}
    </div>
  );
}

/** Optional / read-only style marker — caps tag, not parenthetical prose (§7.4). */
function FieldTag({ children }: { children: string }) {
  return <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{children}</span>;
}

const INVALID_BORDER =
  "aria-[invalid=true]:border-[color:color-mix(in_oklab,var(--danger-ink)_55%,var(--border-strong))]";
/** Leading icon: quiet by default, accent on field focus (focus-within). */
const FIELD_ICON = "text-[var(--text-tertiary)] transition-colors group-focus-within:text-[var(--accent-strong)]";

/** Icon-led text field with a reserved error slot. */
export function AuthTextField({
  id,
  name,
  label,
  tag,
  icon: Icon,
  type = "text",
  autoComplete,
  required,
  autoFocus,
  placeholder,
  inputClassName = "",
  error,
}: {
  id: string;
  name: string;
  label: string;
  tag?: string;
  icon: LucideIcon;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  inputClassName?: string;
  error?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="ui-label-caps">
        {label}
        {tag ? <FieldTag>{tag}</FieldTag> : null}
      </label>
      <div className="group relative">
        <span className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${FIELD_ICON}`} aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={`ui-input pl-10 ${INVALID_BORDER} ${inputClassName}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <MessageSlot errorId={errorId} error={error} />
    </div>
  );
}

/** Password field — self-contained show/hide, requirement line, error slot. */
export function AuthPasswordField({
  id,
  name,
  label,
  requirementHint,
  autoComplete,
  autoFocus,
  showLabel,
  hideLabel,
  labelAccessory,
  error,
  invalid,
}: {
  id: string;
  name: string;
  label: string;
  requirementHint?: string;
  autoComplete: string;
  autoFocus?: boolean;
  showLabel: string;
  hideLabel: string;
  labelAccessory?: ReactNode;
  error?: string;
  /** Mark the border invalid without showing its own message (e.g. mismatch on the paired field). */
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  const reqId = `${id}-req`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : requirementHint ? reqId : undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="ui-label-caps !mb-0">
          {label}
        </label>
        {labelAccessory}
      </div>
      <div className="group relative mt-1.5">
        <span className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${FIELD_ICON}`} aria-hidden>
          <KeyRound className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={`ui-input pl-10 pr-12 ${INVALID_BORDER}`}
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
          aria-label={show ? hideLabel : showLabel}
          title={show ? hideLabel : showLabel}
          className={`absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
            show
              ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_40%,var(--surface-raised))] text-[var(--accent-strong)]"
              : "text-[var(--text-tertiary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_60%,transparent)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {show ? <EyeOff className="h-4 w-4" strokeWidth={1.85} aria-hidden /> : <Eye className="h-4 w-4" strokeWidth={1.85} aria-hidden />}
        </button>
      </div>
      <MessageSlot errorId={errorId} error={error} reqId={reqId} requirement={requirementHint} />
    </div>
  );
}

/** Per-mode field set, composed from the shared field primitives. */
export function AuthFields({
  mode,
  accessCode,
  emailError,
  nameError,
  passwordError,
  confirmError,
}: {
  mode: AuthMode;
  accessCode: string;
  emailError?: string;
  nameError?: string;
  passwordError?: string;
  confirmError?: string;
}) {
  return (
    <div className="space-y-2.5">
      {mode === "signup" ? (
        <>
          <input type="hidden" name="accessCode" value={accessCode} />
          <AuthTextField id="fullName" name="fullName" label="Full name" icon={User} required autoComplete="name" placeholder="Your full name" error={nameError} />
          <AuthTextField id="companyName" name="companyName" label="Company name" tag="Optional" icon={Users} autoComplete="organization" placeholder="e.g. Acme Co." />
        </>
      ) : null}

      {mode !== "reset-password" ? (
        <AuthTextField
          id="email"
          name="email"
          label="Email"
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          autoFocus={mode === "login" || mode === "forgot-password"}
          placeholder="you@company.com"
          inputClassName="text-[13px]"
          error={emailError}
        />
      ) : null}

      {mode === "login" || mode === "signup" ? (
        <AuthPasswordField
          id="password"
          name="password"
          label="Password"
          requirementHint={mode === "signup" ? "8+ characters" : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          showLabel="Show password"
          hideLabel="Hide password"
          error={passwordError}
        />
      ) : null}

      {mode === "reset-password" ? (
        <>
          <AuthPasswordField
            id="password"
            name="password"
            label="New password"
            requirementHint="8+ characters, not reused"
            autoComplete="new-password"
            autoFocus
            showLabel="Show password"
            hideLabel="Hide password"
            error={passwordError}
            invalid={Boolean(confirmError)}
          />
          <AuthPasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            showLabel="Show confirmation"
            hideLabel="Hide confirmation"
            error={confirmError}
          />
        </>
      ) : null}
    </div>
  );
}
