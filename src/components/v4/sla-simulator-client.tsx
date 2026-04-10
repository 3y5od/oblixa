"use client";

import { useMemo, useState } from "react";
import { addHours, format } from "date-fns";

export function SlaSimulatorClient() {
  const [slaHours, setSlaHours] = useState(48);
  const [requestedAt, setRequestedAt] = useState(() =>
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [pathMode, setPathMode] = useState<"sequential" | "parallel">("sequential");

  const breachAt = useMemo(() => {
    const start = new Date(requestedAt);
    if (Number.isNaN(start.getTime())) return null;
    const hours = Math.max(1, slaHours);
    const effective = pathMode === "parallel" ? hours * 0.85 : hours;
    return addHours(start, effective);
  }, [requestedAt, slaHours, pathMode]);

  return (
    <div className="ui-card space-y-4 p-5">
      <p className="ui-eyebrow">Approvals</p>
      <h2 className="ui-section-title mt-1 text-base">Approval SLA simulation</h2>
      <p className="ui-muted-tight">
        Estimate breach time from a hypothetical request. Parallel mode applies a simple 15% compression factor
        for illustration only.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-zinc-600">
          SLA hours
          <input
            type="number"
            min={1}
            max={720}
            value={slaHours}
            onChange={(e) => setSlaHours(Number(e.target.value) || 1)}
            className="ui-input mt-1 w-full"
          />
        </label>
        <label className="text-xs font-medium text-zinc-600">
          Requested at
          <input
            type="datetime-local"
            value={requestedAt}
            onChange={(e) => setRequestedAt(e.target.value)}
            className="ui-input mt-1 w-full"
          />
        </label>
        <label className="text-xs font-medium text-zinc-600 sm:col-span-2">
          Path mode
          <select
            value={pathMode}
            onChange={(e) => setPathMode(e.target.value as "sequential" | "parallel")}
            className="ui-input mt-1 w-full"
          >
            <option value="sequential">Sequential (full SLA)</option>
            <option value="parallel">Parallel (demo compression)</option>
          </select>
        </label>
      </div>
      {breachAt ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
          Estimated breach / escalation review at{" "}
          <span className="font-semibold">{format(breachAt, "MMM d, yyyy h:mm a")}</span>
        </p>
      ) : (
        <p className="text-sm text-rose-700">Enter a valid start time.</p>
      )}
    </div>
  );
}
