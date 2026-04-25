"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedDemoWorkspace } from "@/actions/demo";
import { Database } from "lucide-react";

export function DemoSeedButton() {
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await seedDemoWorkspace();
      if (res.error) {
        setMsg({ type: "err", text: res.error });
      } else if ("created" in res && res.success) {
        setMsg({
          type: "ok",
          text: `Added ${res.created} demo contract(s).`,
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-4">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-tertiary)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Demo workspace</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Load sample contracts (titles prefixed with &quot;Demo:&quot;) for
                training or pilots. Requires{" "}
                <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_75%,var(--canvas))] px-1">ENABLE_DEMO_SEED=true</code>{" "}
                on the server.
              </p>
            </div>
            <button
              type="button"
              onClick={run}
              disabled={isPending}
              className="ui-btn-secondary shrink-0 px-3 py-1.5 disabled:opacity-50"
            >
              {isPending ? "Loading…" : "Load demo contracts"}
            </button>
          </div>
          {msg && (
            <p
              className={`mt-2 text-xs ${msg.type === "err" ? "text-red-600" : "text-green-700"}`}
            >
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
