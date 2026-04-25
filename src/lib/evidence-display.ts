function startCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getEvidenceRequirementStatusLabel(status: string): string {
  if (status === "required") return "Requested evidence";
  if (status === "submitted") return "Submitted for review";
  if (status === "rejected") return "Needs correction";
  return startCase(status);
}

export function getEvidenceRequirementTypeLabel(requirementType: string): string {
  if (requirementType === "structured_form") return "Structured form";
  if (requirementType === "external_reference") return "External reference";
  if (requirementType === "manager_approval") return "Manager approval";
  return startCase(requirementType);
}
