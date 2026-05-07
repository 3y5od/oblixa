"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  COMMAND_PALETTE_OPEN_EVENT,
  type CommandPaletteOpenDetail,
} from "@/lib/product-surface/command-palette-bridge";

const CommandPalette = dynamic(
  () =>
    import("@/components/layout/command-palette").then((m) => ({
      default: m.CommandPalette,
    })),
  {
    ssr: false,
    /** Palette is hidden until opened; avoid a layout flash while the chunk loads. */
    loading: () => null,
  }
);

export function CommandPaletteLoader(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
  navSurface?: NavSurfaceInput | null;
  showToolsLink?: boolean;
}) {
  const [openRequest, setOpenRequest] = useState<{ id: number; query: string } | null>(null);
  const shouldLoad = openRequest !== null;

  useEffect(() => {
    if (shouldLoad) return;
    function requestOpen(query = "") {
      setOpenRequest({ id: Date.now(), query });
    }
    function onPaletteOpen(event: Event) {
      const ce = event as CustomEvent<CommandPaletteOpenDetail>;
      requestOpen(typeof ce.detail?.query === "string" ? ce.detail.query : "");
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        requestOpen("");
      }
    }
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [shouldLoad]);

  if (!shouldLoad) return null;

  return (
    <CommandPalette
      key={openRequest.id}
      role={props.role}
      v5Flags={props.v5Flags}
      navSurface={props.navSurface}
      showToolsLink={props.showToolsLink}
      initialQuery={openRequest.query}
    />
  );
}
