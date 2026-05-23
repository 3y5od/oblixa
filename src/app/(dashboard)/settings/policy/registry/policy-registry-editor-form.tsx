"use client";

import { useActionState, useMemo, useState } from "react";
import { validatePolicyRegistry } from "@/lib/v4/policy-registry";

type RegistryEditorState = { error?: string; success?: boolean };

export function PolicyRegistryEditorForm({
  initialJson,
  saveAction,
}: {
  initialJson: string;
  saveAction: (state: RegistryEditorState, formData: FormData) => Promise<RegistryEditorState>;
}) {
  const [registryJson, setRegistryJson] = useState(initialJson);
  const [state, formAction, pending] = useActionState(saveAction, {});

  const localValidation = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(registryJson);
      const validation = validatePolicyRegistry(parsed);
      if (!validation.ok) return { ok: false as const, message: validation.error };
      return { ok: true as const, message: "Draft registry is valid." };
    } catch {
      return { ok: false as const, message: "Draft is not valid JSON." };
    }
  }, [registryJson]);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <textarea
        name="registryJson"
        required
        rows={20}
        value={registryJson}
        onChange={(event) => setRegistryJson(event.target.value)}
        className="ui-input font-mono text-xs"
      />
      <div
        className={
          localValidation.ok
            ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
            : "ui-alert-error text-xs"
        }
      >
        {localValidation.message}
      </div>
      {state.error ? <p className="ui-alert-error text-xs">{state.error}</p> : null}
      {state.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Registry saved.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !localValidation.ok}
        className="ui-btn-primary px-4 py-2 text-sm disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save registry"}
      </button>
    </form>
  );
}
