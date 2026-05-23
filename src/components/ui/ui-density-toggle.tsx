"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  readTableDensityPreference,
  writeTableDensityPreference,
  type StoredTableDensity,
} from "@/lib/security/client-storage";

export interface UiDensityToggleProps {
  scope?: string;
  ariaLabel?: string;
  onChange?: (density: StoredTableDensity) => void;
}

interface DensityState {
  density: StoredTableDensity;
  hydratedScope: string | null;
}

/**
 * Persistent table density toggle (compact ↔ default ↔ comfortable).
 * Persists per `scope` (default = "default") through the approved client-storage helper.
 * Toggles a class on the nearest `[data-table-density-scope="{scope}"]` ancestor.
 */
export function UiDensityToggle({ scope = "default", ariaLabel = "Table density", onChange }: UiDensityToggleProps) {
  const [state, setState] = useState<DensityState>({
    density: "default",
    hydratedScope: null,
  });

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setState({
        density: readTableDensityPreference(scope) ?? "default",
        hydratedScope: scope,
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [scope]);

  const density = state.hydratedScope === scope ? state.density : "default";

  useEffect(() => {
    const root = document.querySelector(`[data-table-density-scope="${scope}"]`);
    if (!root) return;
    root.classList.remove("ui-table-density-compact", "ui-table-density-comfortable");
    if (density === "compact") root.classList.add("ui-table-density-compact");
    if (density === "comfortable") root.classList.add("ui-table-density-comfortable");
    if (state.hydratedScope !== scope) return;
    writeTableDensityPreference(scope, density);
    onChange?.(density);
  }, [density, scope, state.hydratedScope, onChange]);

  const next: Record<StoredTableDensity, StoredTableDensity> = {
    compact: "default",
    default: "comfortable",
    comfortable: "compact",
  };

  const Icon = density === "compact" ? Maximize2 : Minimize2;

  return (
    <button
      type="button"
      aria-label={`${ariaLabel}: ${density} (click for ${next[density]})`}
      onClick={() =>
        setState({
          density: next[density],
          hydratedScope: scope,
        })
      }
      className="ui-icon-button min-h-7 min-w-7 border-transparent bg-transparent p-1.5 text-[var(--text-tertiary)] shadow-none hover:bg-[var(--surface-tint-soft)] hover:text-[var(--text-primary)]"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
    </button>
  );
}
