type InlineMutationStatusVariant = "success" | "error" | "warning" | "info";

const VARIANT_CLASS_NAME: Record<InlineMutationStatusVariant, string> = {
  success: "ui-alert-success",
  error: "ui-alert-error",
  warning:
    "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100",
  info: "rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-100",
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