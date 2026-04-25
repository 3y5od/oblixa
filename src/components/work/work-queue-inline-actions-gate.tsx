"use client";

import type { ComponentProps } from "react";
import { WorkQueueInlineActions } from "@/components/work/work-queue-inline-actions";
import { v9InlineQueueActionsEnabled } from "@/lib/v9-rollout";

type GateProps = ComponentProps<typeof WorkQueueInlineActions>;

export function WorkQueueInlineActionsGate(props: GateProps) {
  if (!v9InlineQueueActionsEnabled()) return null;
  return <WorkQueueInlineActions {...props} />;
}
