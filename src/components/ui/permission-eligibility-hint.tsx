/**
 * Distinct empty / permission / mode semantics (V9 permissions-visible UI contract).
 */
export type PermissionEligibilityVariant =
  | "hidden"
  | "disabled"
  | "empty"
  | "filtered_out"
  | "not_permitted"
  | "not_in_current_mode";

export function PermissionEligibilityHint(props: {
  variant: PermissionEligibilityVariant;
  /** Optional recovery CTA label */
  actionLabel?: string;
  actionHref?: string;
}) {
  const copy: Record<PermissionEligibilityVariant, string> = {
    hidden: "This capability is not available in your current workspace context.",
    disabled: "This action is blocked until prerequisites are satisfied.",
    empty: "Nothing is in scope for this view right now.",
    filtered_out: "Records exist, but the current filters hide them.",
    not_permitted: "You can see this area, but your role cannot perform this action.",
    not_in_current_mode: "This workflow is intentionally unavailable in the current workspace mode.",
  };
  return (
    <div className="ui-permission-hint">
      <p className="ui-support-copy text-[12.5px]">{copy[props.variant]}</p>
      {props.actionLabel && props.actionHref ? (
        <a href={props.actionHref} className="ui-link mt-2 inline-block text-[12.5px] font-medium">
          {props.actionLabel}
        </a>
      ) : null}
    </div>
  );
}
