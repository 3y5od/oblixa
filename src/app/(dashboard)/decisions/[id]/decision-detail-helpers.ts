export function workflowFieldsFromScope(scope: unknown) {
  const value = scope as Record<string, unknown> | null | undefined;
  if (!value) {
    return {
      workflowStepCount: 0,
      workflowDeadlineIso: null as string | null,
      lastWorkflowStepType: null as string | null,
      correctionMessage: null as string | null,
    };
  }
  const chain = Array.isArray(value.workflow_chain) ? value.workflow_chain : [];
  const last = chain.length > 0 ? (chain[chain.length - 1] as Record<string, unknown>) : null;
  return {
    workflowStepCount: chain.length,
    workflowDeadlineIso: typeof value.workflow_deadline_iso === "string" ? value.workflow_deadline_iso : null,
    lastWorkflowStepType: last && typeof last.type === "string" ? last.type : null,
    correctionMessage: typeof value.correction_message === "string" ? value.correction_message : null,
  };
}
