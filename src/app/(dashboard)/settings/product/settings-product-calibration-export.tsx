"use client";

/** Export uses a server action only; this module does not call Sentry or add client breadcrumbs. */

import { useCallback, useState, useTransition } from "react";
import { exportOnboardingCalibrationSupportJson } from "@/actions/onboarding-calibration";

function utcCompactIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

export function SettingsProductCalibrationExport(props: { orgFingerprint: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onExport = useCallback(() => {
    setMessage(null);
    startTransition(async () => {
      const res = await exportOnboardingCalibrationSupportJson();
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      let fingerprint = props.orgFingerprint;
      try {
        const parsed = JSON.parse(res.json) as { organization_fingerprint?: string };
        if (typeof parsed.organization_fingerprint === "string") {
          fingerprint = parsed.organization_fingerprint;
        }
      } catch {
        /* use prop */
      }
      const filename = `onboarding-calibration-${fingerprint}-${utcCompactIso()}.json`;
      const blob = new Blob([res.json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Download started.");
    });
  }, [props.orgFingerprint]);

  return (
    <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
      <p className="ui-label-caps">Support export</p>
      <p className="ui-muted-tight mt-2 text-[13px] text-zinc-700">
        Download a JSON file with the workspace questionnaire record for troubleshooting. Only workspace
        admins can export; the file is generated on the server for the current organization.
      </p>
      <button
        type="button"
        className="ui-btn-secondary mt-3 min-h-9 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
        onClick={onExport}
        disabled={isPending}
        aria-busy={isPending}
        aria-disabled={isPending}
      >
        {isPending ? "Preparing export…" : "Export questionnaire JSON"}
      </button>
      <p className="ui-muted-tight mt-2 min-h-[1.25rem] text-[13px] text-zinc-700" aria-live="polite">
        {message ?? "\u00a0"}
      </p>
    </div>
  );
}
