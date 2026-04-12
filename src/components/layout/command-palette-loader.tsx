"use client";

import dynamic from "next/dynamic";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";

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
}) {
  return (
    <CommandPalette role={props.role} v5Flags={props.v5Flags} navSurface={props.navSurface} />
  );
}
