"use client";

import dynamic from "next/dynamic";
import type { WorkspaceRole } from "@/lib/navigation";

const CommandPalette = dynamic(
  () =>
    import("@/components/layout/command-palette").then((m) => ({
      default: m.CommandPalette,
    })),
  { ssr: false }
);

export function CommandPaletteLoader(props: { role?: WorkspaceRole }) {
  return <CommandPalette role={props.role} />;
}
