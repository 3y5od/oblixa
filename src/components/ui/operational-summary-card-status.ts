import type { SemanticStatus } from "@/components/ui/status-badge";
import type { OperationalTone } from "@/lib/ui/operational-surface";

export function semanticStatusToOperationalTone(status: SemanticStatus): OperationalTone {
  switch (status) {
    case "healthy":
      return "healthy";
    case "warning":
      return "attention";
    case "blocked":
    case "overdue":
    case "critical":
      return "risk";
    case "empty":
    case "disabled":
    case "info":
    case "in_review":
    default:
      return "neutral";
  }
}

export function badgeForTone(tone: OperationalTone): { status: SemanticStatus; label: string } | null {
  switch (tone) {
    case "healthy":
      return { status: "healthy", label: "Clear" };
    case "attention":
      return { status: "warning", label: "Watch" };
    case "risk":
      return { status: "critical", label: "At risk" };
    case "neutral":
    default:
      return null;
  }
}
