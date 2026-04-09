"use client";

import dynamic from "next/dynamic";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";

const CommandPalette = dynamic(
  () =>
    import("@/components/layout/command-palette").then((m) => ({
      default: m.CommandPalette,
    })),
  { ssr: false }
);

export function CommandPaletteLoader(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
}) {
  return <CommandPalette role={props.role} v5Flags={props.v5Flags} />;
}
