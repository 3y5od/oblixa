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
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 text-gray-500" />
        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Demo workspace</h3>
          <p className="text-xs text-gray-600">
            Load sample contracts (titles prefixed with &quot;Demo:&quot;) for
            training or pilots. Requires{" "}
            <code className="rounded bg-gray-200 px-1">ENABLE_DEMO_SEED=true</code>{" "}
            on the server.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={isPending}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
