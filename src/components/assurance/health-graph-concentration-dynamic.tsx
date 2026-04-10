"use client";

import dynamic from "next/dynamic";
import type { HealthGraphConcentrationProps } from "@/components/assurance/health-graph-concentration";

const HealthGraphConcentration = dynamic(
  () =>
    import("@/components/assurance/health-graph-concentration").then((m) => ({
      default: m.HealthGraphConcentration,
    })),
  {
    ssr: false,
    loading: () => <p className="ui-muted-tight text-sm">Loading health graph…</p>,
  }
);

export function HealthGraphConcentrationDynamic(props: HealthGraphConcentrationProps) {
  return <HealthGraphConcentration {...props} />;
}
