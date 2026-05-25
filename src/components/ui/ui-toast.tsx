"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { UiSpinner } from "@/components/ui/ui-spinner";

export type ToastTone = "neutral" | "success" | "warning" | "danger" | "loading";

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastContextValue | null>(null);

export function UiToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismissTimersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = dismissTimersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev, { ...toast, id }]);
      if (toast.tone !== "loading") {
        const duration = toast.durationMs ?? 4000;
        const timer = window.setTimeout(() => dismiss(id), duration);
        dismissTimersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  useEffect(() => {
    const dismissTimers = dismissTimersRef.current;
    return () => {
      for (const timer of dismissTimers.values()) {
        window.clearTimeout(timer);
      }
      dismissTimers.clear();
    };
  }, []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastViewport items={items} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Fallback no-op so calling components don't crash when provider isn't mounted.
    return {
      show: () => "",
      dismiss: () => undefined,
    };
  }
  return v;
}

function ToastViewport({
  items,
  dismiss,
}: {
  items: ToastItem[];
  dismiss: (id: string) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[var(--z-toast,60)] flex flex-col gap-2"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  );
}

function toneAccent(tone: ToastTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "loading") return "var(--accent)";
  return "var(--text-tertiary)";
}

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "loading") return <UiSpinner size="sm" />;
  if (tone === "success")
    return <CheckCircle2 className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
  if (tone === "warning")
    return <TriangleAlert className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
  if (tone === "danger")
    return <AlertCircle className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
  return <Info className="h-4 w-4" strokeWidth={1.85} aria-hidden />;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 10);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 160ms ease-out, transform 160ms ease-out",
      }}
      className="ui-card-raised flex w-[22rem] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-3 shadow-[var(--shadow-3)]"
    >
      <span
        className="inline-flex shrink-0 items-center pt-0.5"
        style={{ color: toneAccent(item.tone) }}
      >
        <ToneIcon tone={item.tone} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
          {item.title}
        </p>
        {item.description ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {item.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ui-btn-ghost inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md p-0 text-[var(--text-tertiary)]"
      >
        <X className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      </button>
    </div>
  );
}
