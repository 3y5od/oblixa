export const FIELD_REVIEW_TITLE = "Review fields";
export const FIELD_REVIEW_EYEBROW = "Field review";
export const FIELD_REVIEW_EMPTY_STATE = "No fields need review.";

export const FIELD_REVIEW_REQUIRED_CONTENT = [
  "Field name",
  "Suggested value",
  "Source snippet",
  "Document preview",
  "Confidence indicator",
  "Current approved value",
  "Review progress",
] as const;

export const FIELD_REVIEW_ACTIONS = [
  "Approve",
  "Edit",
  "Mark unknown",
  "Skip",
] as const;

export const FIELD_REVIEW_IMPORTANT_FIELD_ALIASES = [
  { label: "Counterparty", keys: ["counterparty"] },
  { label: "Effective date", keys: ["effective_date", "start_date"] },
  { label: "Renewal date", keys: ["renewal_date"] },
  { label: "Notice deadline", keys: ["notice_deadline", "notice_window"] },
  { label: "Termination date", keys: ["termination_date", "end_date"] },
  { label: "Contract value", keys: ["contract_value", "fee_reference"] },
  { label: "Payment terms", keys: ["payment_terms", "payment_cadence"] },
  { label: "Governing law", keys: ["governing_law"] },
  { label: "Auto-renewal", keys: ["auto_renewal"] },
  { label: "Owner", keys: ["owner", "owner_id"] },
  { label: "Obligations", keys: ["obligations", "obligation"] },
] as const;
