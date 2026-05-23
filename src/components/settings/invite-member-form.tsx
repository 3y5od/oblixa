"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Mail, UserCircle2 } from "lucide-react";
import { inviteOrgMember } from "@/actions/settings";

interface InviteMemberFormProps {
  organizationId: string;
}

const ROLES = [
  { value: "editor", label: "Editor", description: "Edit contracts and operational data." },
  { value: "viewer", label: "Viewer", description: "Read-only access to workspace content." },
  { value: "admin", label: "Admin", description: "Manage members, billing, and policies." },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

function RoleDropdown({
  value,
  onChange,
}: {
  value: RoleValue;
  onChange: (next: RoleValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [menuRect, setMenuRect] = useState<{ top: number; right: number; width: number } | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = ROLES.find((r) => r.value === value) ?? ROLES[0];
  const selectedIndex = Math.max(0, ROLES.findIndex((r) => r.value === value));

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuWidth = 240;
      setMenuRect({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
        width: Math.max(menuWidth, rect.width),
      });
    };
    updateRect();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onWindowChange = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onWindowChange, true);
    window.addEventListener("resize", onWindowChange);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onWindowChange, true);
      window.removeEventListener("resize", onWindowChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelectorAll<HTMLElement>("[role='option']")[focusedIndex];
    item?.scrollIntoView({ block: "nearest" });
  }, [open, focusedIndex]);

  const handleTriggerKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setFocusedIndex(selectedIndex);
      setOpen(true);
    }
  };

  const handleTriggerClick = () => {
    const nextOpen = !open;
    if (nextOpen) setFocusedIndex(selectedIndex);
    setOpen(nextOpen);
  };

  const handleListKey = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((i) => (i + 1) % ROLES.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((i) => (i - 1 + ROLES.length) % ROLES.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setFocusedIndex(ROLES.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const focused = ROLES[focusedIndex];
      if (focused) {
        onChange(focused.value);
        setOpen(false);
        buttonRef.current?.focus();
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <input type="hidden" name="role" value={value} />
      <button
        ref={buttonRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Role: ${selected.label}`}
        className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white)] pl-3 pr-3 text-[12.5px] font-medium leading-tight text-[var(--text-primary)] outline-none transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] hover:bg-[var(--surface-raised)] focus-visible:border-[color:color-mix(in_oklab,var(--accent)_50%,var(--border-strong))] focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_40%,transparent),0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)] sm:w-40"
      >
        <UserCircle2
          className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent-strong)] group-focus-visible:text-[var(--accent-strong)]"
          strokeWidth={1.85}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.85}
          aria-hidden
        />
      </button>
      {open && menuRect && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Role"
              tabIndex={-1}
              onKeyDown={handleListKey}
              autoFocus
              style={{
                position: "fixed",
                top: menuRect.top,
                right: menuRect.right,
                width: menuRect.width,
              }}
              className="z-[60] overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_8%,var(--border-subtle))] bg-[var(--surface-raised)] p-1 shadow-[var(--shadow-3)] outline-none"
            >
              {ROLES.map((role, index) => {
                const isSelected = role.value === value;
                const isFocused = index === focusedIndex;
                return (
                  <li
                    key={role.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setFocusedIndex(index)}
                    onClick={() => {
                      onChange(role.value);
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors ${
                      isFocused
                        ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,transparent)]"
                        : ""
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--accent-strong)]">
                      {isSelected ? <Check className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tracking-tight text-[var(--text-primary)]">
                        {role.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-tertiary)]">
                        {role.description}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}

export function InviteMemberForm({ organizationId }: InviteMemberFormProps) {
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<RoleValue>("editor");

  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4">
      <div className="flex items-baseline gap-2.5">
        <h3 className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
          Invite teammate
        </h3>
        <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
          Sends a secure email invite · expires after seven days.
        </p>
      </div>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          const fd = new FormData(e.currentTarget);
          fd.set("organizationId", organizationId);
          startTransition(async () => {
            const result = await inviteOrgMember(fd);
            if (result && "error" in result && result.error) {
              setMessage({ type: "err", text: result.error });
              return;
            }
            setMessage({ type: "ok", text: "Invitation sent." });
            (e.target as HTMLFormElement).reset();
            setRole("editor");
          });
        }}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="invite-email" className="sr-only">
            Email
          </label>
          <span
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
            aria-hidden
          >
            <Mail className="h-3.5 w-3.5" />
          </span>
          <input aria-label="colleague@company.com" id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="colleague@company.com"
            className="ui-input pl-9 font-mono text-[12.5px] placeholder:font-mono"
          />
        </div>
        <RoleDropdown value={role} onChange={setRole} />
        <button
          type="submit"
          disabled={isPending}
          className="ui-btn-primary shrink-0 text-[12.5px] disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send invite"}
        </button>
      </form>
      {message && (
        <p
          className={`mt-2 text-xs ${message.type === "ok" ? "ui-alert-success" : "ui-alert-error"}`}
          role={message.type === "ok" ? "status" : "alert"}
          aria-live={message.type === "ok" ? "polite" : "assertive"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
