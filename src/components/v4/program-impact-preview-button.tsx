"use client";

import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function ProgramImpactPreviewButton({ programId }: { programId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setPreview(null);
    setError(null);
    try {
      const result = await mutateJson(`/api/programs/${programId}/preview-impact`, {
        method: "POST",
      });
      if (!result.ok) {
        setError(result.message || "Preview failed");
        return;
      }
      setPreview(JSON.stringify(result.data, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <AsyncActionButton type="button" onClick={() => void loadPreview()} className="ui-btn-secondary px-3 py-1.5 text-xs" pending={loading} pendingLabel="Preview…">
        Impact preview
      </AsyncActionButton>
      <InlineMutationStatus message={error} variant="error" className="text-xs" />
      {preview ? (
        <pre className="max-h-48 overflow-auto rounded border border-[var(--border-subtle)] bg-surface p-2 text-[10px] text-[var(--text-primary)]">
          {preview}
        </pre>
      ) : null}
    </div>
  );
}
