"use client";

import { useState } from "react";

export function ProgramImpactPreviewButton({ programId }: { programId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setPreview(null);
          try {
            const res = await fetch(`/api/programs/${programId}/preview-impact`, {
              method: "POST",
              credentials: "same-origin",
            });
            const data = await res.json().catch(() => ({}));
            setPreview(JSON.stringify(data, null, 2));
          } finally {
            setLoading(false);
          }
        }}
        className="ui-btn-secondary px-3 py-1.5 text-xs"
      >
        {loading ? "Preview…" : "Impact preview"}
      </button>
      {preview ? (
        <pre className="max-h-48 overflow-auto rounded border border-zinc-200 bg-surface p-2 text-[10px] text-zinc-800">
          {preview}
        </pre>
      ) : null}
    </div>
  );
}
