import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function AsyncActionButton({
  pending = false,
  pendingLabel,
  children,
  className = "",
  disabled,
  hideSpinner = false,
  statusId,
  "aria-describedby": ariaDescribedBy,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  pending?: boolean;
  pendingLabel: ReactNode;
  children: ReactNode;
  hideSpinner?: boolean;
  statusId?: string;
}) {
  const describedBy = [ariaDescribedBy, statusId].filter(Boolean).join(" ") || undefined;

  return (
    <button
      {...props}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      aria-describedby={describedBy}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          {hideSpinner ? null : <Loader2 size={14} className="animate-spin" aria-hidden />}
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}