"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Search, X } from "lucide-react";

/** Shared search-input primitive used by the cmd-K overlay, the chrome
 *  header search, and the dedicated `/search` page. One source of truth for
 *  input chrome (icon, kbd hint), input semantics (IME, paste sanitation,
 *  mobile keyboard hints), and bounded value handling. T6.4. */

const MAX_QUERY_LENGTH = 200;

/** Strip control / bidi-override / zero-width / BOM characters that can mask
 *  visible text (homograph phishing, audit-log spoofing). Mirrors the safe-
 *  text predicate elsewhere in the codebase. T12.3. */
const UNSAFE_TEXT_RE = new RegExp(
  "[\\u0000-\\u0008\\u000B-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]",
  "g"
);

function sanitizeQuery(raw: string): string {
  return raw.replace(UNSAFE_TEXT_RE, "").slice(0, MAX_QUERY_LENGTH);
}

export interface SearchFieldHandle {
  focus: () => void;
  select: () => void;
  blur: () => void;
}

export interface SearchFieldProps {
  /** Input `name` for form submission. */
  name?: string;
  /** Initial value (uncontrolled fallback). */
  defaultValue?: string;
  /** Controlled value. When set, `onChange` is required. */
  value?: string;
  /** Fires after sanitation: stripped of bidi/control chars, bounded length. */
  onChange?: (value: string) => void;
  /** Fires on Enter (Submit) with the sanitized value. */
  onSubmit?: (value: string) => void;
  /** V2 T5.8 — fires on Cmd/Ctrl+Enter; caller opens in new tab. */
  onSubmitNewTab?: (value: string) => void;
  /** V2 T5.5 — fires on Escape when input has a value. */
  onClear?: () => void;
  placeholder?: string;
  /** Visible kbd hint (e.g. "⌘ K"). Suppressed when `isOpen` is true so the
   *  badge in an open overlay swaps to `Esc` instead. T0.9. */
  kbdHint?: { meta: string; key: string };
  /** When true, the field is rendered inside an open overlay. Affects the
   *  kbd hint and aria-expanded semantics. */
  isOpen?: boolean;
  /** ARIA combobox wiring. T5.1. */
  ariaControls?: string;
  ariaActivedescendant?: string;
  ariaLabel?: string;
  /** Space-separated key bindings the input responds to. Mirrors WAI-ARIA
   *  `aria-keyshortcuts` so SR users discover the bindings without reading
   *  visual kbd badges. */
  ariaKeyShortcuts?: string;
  /** When true, focus on mount via useEffect (not the autoFocus attr — gives
   *  the page a tick to paint first; mitigates iOS Safari layout-shift
   *  weirdness when the soft keyboard appears). T13.4. */
  autoFocusDeferred?: boolean;
  /** test-id passthrough. */
  testId?: string;
  /** Optional trailing content (e.g. status spinner). */
  trailing?: ReactNode;
  /** Size variant — `overlay` is compact, `page` is the large dedicated-page
   *  search input. */
  variant?: "overlay" | "page" | "chrome";
}

export const SearchField = forwardRef<SearchFieldHandle, SearchFieldProps>(function SearchField(
  {
    name = "q",
    defaultValue,
    value,
    onChange,
    onSubmit,
    onSubmitNewTab,
    onClear,
    placeholder = "Type to filter destinations…",
    kbdHint,
    isOpen,
    ariaControls,
    ariaActivedescendant,
    ariaLabel = "Search workspace",
    ariaKeyShortcuts,
    autoFocusDeferred,
    testId,
    trailing,
    variant = "page",
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const current = isControlled ? value ?? "" : innerValue;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    select: () => inputRef.current?.select(),
    blur: () => inputRef.current?.blur(),
  }));

  // T13.4 — deferred focus on mount, lets the page paint first.
  useEffect(() => {
    if (!autoFocusDeferred) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [autoFocusDeferred]);

  const propagate = useCallback(
    (next: string) => {
      const safe = sanitizeQuery(next);
      if (!isControlled) setInnerValue(safe);
      onChange?.(safe);
    },
    [isControlled, onChange]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      // T12.2 — gate `onChange` during IME composition; commit only on
      // compositionend so CJK / accented input doesn't fire intermediate
      // filter passes.
      if (isComposingRef.current) {
        if (!isControlled) setInnerValue(event.target.value);
        return;
      }
      propagate(event.target.value);
    },
    [isControlled, propagate]
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = false;
      propagate((event.target as HTMLInputElement).value);
    },
    [propagate]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      // T12.3 — sanitize pasted text before letting the input swallow it.
      const pasted = event.clipboardData?.getData("text") ?? "";
      const safe = sanitizeQuery(pasted);
      if (safe !== pasted) {
        event.preventDefault();
        const input = inputRef.current;
        if (input) {
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? input.value.length;
          const next = sanitizeQuery(input.value.slice(0, start) + safe + input.value.slice(end));
          if (!isControlled) setInnerValue(next);
          onChange?.(next);
          window.requestAnimationFrame(() => {
            input.setSelectionRange(start + safe.length, start + safe.length);
          });
        }
      }
    },
    [isControlled, onChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // ESC clears when there's a value; otherwise blurs. Mirrors the
      // clear-X button: in uncontrolled mode we also reset the internal
      // value so the visible text actually clears (controlled mode relies
      // on the parent's `onClear` to propagate via the `value` prop).
      if (event.key === "Escape") {
        if (current.length > 0) {
          event.preventDefault();
          if (!isControlled) setInnerValue("");
          onClear?.();
        } else {
          inputRef.current?.blur();
        }
        return;
      }
      if (event.key !== "Enter") return;
      if (isComposingRef.current) return; // IME confirm — don't submit.
      if (event.shiftKey || event.altKey) return;
      // V2 T5.8 — Cmd/Ctrl+Enter opens the active row in a new tab.
      if (event.metaKey || event.ctrlKey) {
        if (onSubmitNewTab) {
          event.preventDefault();
          onSubmitNewTab(sanitizeQuery(current));
        }
        return;
      }
      event.preventDefault();
      onSubmit?.(sanitizeQuery(current));
    },
    [current, isControlled, onSubmit, onSubmitNewTab, onClear]
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isComposingRef.current) return;
      onSubmit?.(sanitizeQuery(current));
    },
    [current, onSubmit]
  );

  // The page variant scales up; overlay/chrome stay compact. Right padding
  // reserves room for the trailing kbd hint + (when value is present) the
  // clear-X button so the placeholder/value text never collides with them.
  const sizeClass =
    variant === "page"
      ? "ui-input min-h-13 pl-12 pr-16 text-[16px]"
      : variant === "overlay"
        ? "ui-input min-h-11 pl-11 pr-12 text-[14px]"
        : "ui-input min-h-11 pl-11 pr-12 text-sm";
  const iconSizeClass = variant === "page" ? "h-5 w-5" : "h-4 w-4";
  const iconLeftClass = variant === "page" ? "left-4" : "left-4";

  // When the field has a value (and an `onClear` handler), surface an Esc
  // hint so users discover the clear shortcut. The overlay variant
  // (`isOpen`) always shows Esc since pressing Escape closes the overlay.
  const effectiveKbdHint =
    isOpen
      ? { meta: "", key: "Esc" }
      : current.length > 0 && onClear
        ? { meta: "", key: "Esc" }
        : kbdHint;

  return (
    <form
      role="search"
      onSubmit={handleFormSubmit}
      aria-label={ariaLabel}
      className="relative w-full"
      // T15.8 — no `action` attribute. Submission flows through `onSubmit`
      // → onSubmit prop. A JS failure path must NOT POST anywhere.
    >
      {/* Clicking the icon focuses + selects the input — common search-UI
          affordance. Pointer-events stay enabled so the click target is real. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Focus search input"
        onClick={() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
        className={`absolute ${iconLeftClass} top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] focus:outline-none`}
      >
        <Search aria-hidden className={`${iconSizeClass}`} strokeWidth={1.85} />
      </button>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        name={name}
        value={isControlled ? value : undefined}
        defaultValue={isControlled ? undefined : defaultValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={isOpen ? "true" : "false"}
        aria-autocomplete="list"
        aria-controls={ariaControls}
        aria-activedescendant={ariaActivedescendant}
        aria-keyshortcuts={ariaKeyShortcuts}
        // Mobile keyboard hints + autocorrect reset.
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={MAX_QUERY_LENGTH}
        data-testid={testId}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className={`${sizeClass} w-full tabular-nums`}
      />
      <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {/* Clear-X button — appears only when the input has a value and a
            clear handler. Mouse users get the affordance without needing to
            discover the Esc shortcut. */}
        {current.length > 0 && onClear ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              if (!isControlled) setInnerValue("");
              onClear?.();
              inputRef.current?.focus();
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
          >
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
        <span className="pointer-events-none flex items-center gap-1">
          {trailing}
          {effectiveKbdHint ? (
            <span className="hidden items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] sm:inline-flex">
              {effectiveKbdHint.meta ? <kbd className="ui-kbd">{effectiveKbdHint.meta}</kbd> : null}
              <kbd className="ui-kbd">{effectiveKbdHint.key}</kbd>
            </span>
          ) : null}
        </span>
      </span>
    </form>
  );
});

export { MAX_QUERY_LENGTH, sanitizeQuery };
