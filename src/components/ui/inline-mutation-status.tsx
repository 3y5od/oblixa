type InlineMutationStatusVariant = "success" | "error" | "warning" | "info";

const VARIANT_CLASS_NAME: Record<InlineMutationStatusVariant, string> = {
  success: "ui-alert-success",
  error: "ui-alert-error",
  warning: "ui-alert-warning",
  info: "ui-alert-info",
};

export function InlineMutationStatus({
  message,
  variant,
  id,
  className = "",
}: {
  message: string | null;
  variant: InlineMutationStatusVariant;
  id?: string;
  className?: string;
}) {
  if (!message) return null;
  const role = variant === "error" ? "alert" : "status";
  const live = variant === "error" ? "assertive" : "polite";

  return (
    <p id={id} role={role} aria-live={live} className={`${VARIANT_CLASS_NAME[variant]} ${className}`.trim()}>
      {message}
    </p>
  );
}

export type { InlineMutationStatusVariant };