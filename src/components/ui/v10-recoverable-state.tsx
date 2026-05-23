import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import {
  validateV10UiStateContract,
  type V10RecoverableUiState,
} from "@/lib/v10-ui-state-contracts";

const V10_ALERT_STATES = new Set<V10RecoverableUiState>([
  "failed",
  "unauthorized",
  "forbidden",
  "not_found",
  "deleted",
  "terminal_failure",
  "external_link_expired",
  "external_link_revoked",
]);

const V10_EMPTY_STATES = new Set<V10RecoverableUiState>(["empty"]);
const V10_PARTIAL_STATES = new Set<V10RecoverableUiState>(["partial"]);

function shouldShowV10RecoverableDiagnostics() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS === "1";
}

export function V10RecoverableState(props: {
  state: V10RecoverableUiState;
  title: string;
  reason: string;
  accessibleName: string;
  nextAction?: ReactNode;
  nextActionLabel?: string;
  noActionExplanation?: string;
  surface?: string;
  section?: string;
  sourceObject?: string;
  diagnosticId?: string | null;
  density?: "compact" | "standard";
  className?: string;
}) {
  const contractFailures = validateV10UiStateContract({
    state: props.state,
    reason: props.reason,
    nextActionLabel: props.nextActionLabel,
    noActionExplanation: props.noActionExplanation,
    accessibleName: props.accessibleName,
  });
  const showDiagnostics = contractFailures.length > 0 && shouldShowV10RecoverableDiagnostics();
  if (showDiagnostics) {
    console.warn("[v10-recoverable-state] contract violation", {
      state: props.state,
      failures: contractFailures,
    });
  }
  const isUrgentState = V10_ALERT_STATES.has(props.state);
  const density = props.density ?? "standard";
  const panelTone = isUrgentState
    ? "ui-status-panel-risk"
    : V10_PARTIAL_STATES.has(props.state)
      ? "ui-status-panel-warning"
      : V10_EMPTY_STATES.has(props.state)
        ? ""
        : "ui-status-panel-info";
  const densityClass =
    density === "compact"
      ? "px-3.5 py-3 text-[12.5px]"
      : "text-sm";
  const iconClass = isUrgentState
    ? "text-[var(--danger-ink)]"
    : V10_PARTIAL_STATES.has(props.state)
      ? "text-amber-600"
      : "text-[var(--text-tertiary)]";
  const StateIcon = V10_EMPTY_STATES.has(props.state) ? Inbox : AlertTriangle;

  return (
    <section
      role={isUrgentState ? "alert" : "status"}
      aria-live={isUrgentState ? "assertive" : "polite"}
      aria-label={props.accessibleName}
      tabIndex={-1}
      data-v10-state={props.state}
      data-v10-surface={props.surface ?? ""}
      data-v10-section={props.section ?? ""}
      data-v10-action={props.nextActionLabel ?? ""}
      data-v10-source-object={props.sourceObject ?? ""}
      data-v10-diagnostic-id={props.diagnosticId ?? ""}
      data-v10-contract-ok={contractFailures.length === 0 ? "true" : "false"}
      data-v10-focus-target="recoverable-state"
      data-v10-next-action-label={props.nextActionLabel ?? ""}
      className={`ui-status-panel ${panelTone} ${densityClass} text-[var(--text-secondary)] ${props.className ?? ""}`.trim()}
    >
      <div className="flex items-start gap-3">
        <StateIcon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
        <div>
          <p className="font-medium text-[var(--text-primary)]">{props.title}</p>
          <p className="mt-1">{props.reason}</p>
          {props.noActionExplanation ? <p className="mt-1">{props.noActionExplanation}</p> : null}
          {showDiagnostics ? (
            <p className="mt-2 text-xs" data-v10-contract-failures={contractFailures.join(",")}>
              State contract needs attention: {contractFailures.join(", ")}
            </p>
          ) : null}
          {props.nextAction ? <div className="mt-3 flex flex-wrap gap-2">{props.nextAction}</div> : null}
        </div>
      </div>
    </section>
  );
}
