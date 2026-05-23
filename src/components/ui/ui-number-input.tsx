"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";

export interface UiNumberInputProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  name?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function UiNumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  name,
  ariaLabel,
  disabled,
  className,
}: UiNumberInputProps) {
  const id = useId();
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  const decrement = () => onChange(clamp(value - step));
  const increment = () => onChange(clamp(value + step));

  return (
    <div
      className={`inline-flex h-9 items-stretch overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] focus-within:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-strong))] ${className ?? ""}`}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={decrement}
        aria-label="Decrement"
        className="inline-flex items-center justify-center px-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tint-soft)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
      </button>
      <input
        id={id}
        type="number"
        name={name}
        aria-label={ariaLabel ?? name ?? "Number"}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(clamp(next));
        }}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        disabled={disabled}
        className="w-16 border-x border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-transparent px-2 text-center text-[12.5px] tabular-nums text-[var(--text-primary)] outline-none disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={increment}
        aria-label="Increment"
        className="inline-flex items-center justify-center px-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tint-soft)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
      </button>
    </div>
  );
}
