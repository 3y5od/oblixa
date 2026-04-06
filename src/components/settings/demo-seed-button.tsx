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
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 text-zinc-500" />
        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900">Demo workspace</h3>
          <p className="text-xs text-zinc-600">
            Load sample contracts (titles prefixed with &quot;Demo:&quot;) for
            training or pilots. Requires{" "}
            <code className="rounded bg-zinc-200 px-1">ENABLE_DEMO_SEED=true</code>{" "}
            on the server.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={isPending}
            className="ui-btn-secondary px-3 py-1.5 disabled:opacity-50"
          >
            {isPending ? "Loading…" : "Load demo contracts"}
          </button>
          {msg && (
            <p
              className={`text-xs ${msg.type === "err" ? "text-red-600" : "text-green-700"}`}
            >
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
