"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UiSelect } from "@/components/ui/ui-select";

export function OptionalTag() {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
      Optional
    </span>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
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

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="mt-1 min-h-[0.9rem] text-[11px] leading-snug text-[var(--danger-ink)]">
      {message}
    </p>
  );
}

export function TextField({
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

export function SelectField({
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

export function SegmentedField({
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
