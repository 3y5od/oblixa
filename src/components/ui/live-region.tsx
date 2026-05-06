import type { ReactNode } from "react";

export function LiveRegion({
  message,
  politeness = "polite",
  role,
  className = "sr-only",
}: {
  message?: ReactNode;
  politeness?: "polite" | "assertive";
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div
      className={className}
      aria-atomic="true"
      aria-live={politeness}
      role={role ?? (politeness === "assertive" ? "alert" : "status")}
    >
      {message ?? ""}
    </div>
  );
}