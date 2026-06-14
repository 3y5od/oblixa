export const contractRanges = [
  { value: "under_20", label: "Under 20" },
  { value: "20_50", label: "20-50" },
  { value: "50_200", label: "50-200" },
  { value: "200_plus", label: "More than 200" },
] as const;

export const trackingMethods = [
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "shared_folder", label: "Shared folder" },
  { value: "email_calendar", label: "Email or calendar reminders" },
  { value: "memory", label: "Someone's memory" },
  { value: "mixed", label: "A mix of tools" },
  { value: "other", label: "Other" },
] as const;

export const yesNoUnsure = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
] as const;

export const preferences = [
  { value: "async", label: "Async questions first" },
  { value: "call", label: "Short call if there is a fit" },
  { value: "either", label: "Either is fine" },
] as const;

export const nextSteps = [
  { label: "Reviewed for fit", detail: "Reviewed against workspace fit." },
  { label: "We follow up", detail: "If there is a fit, we follow up with a few questions." },
  { label: "Invite to start", detail: "An invite to start a bounded first workspace." },
] as const;

export const FIELD_IDS: Record<string, string> = {
  name: "contact-name",
  email: "contact-email",
  company: "contact-company",
  role: "contact-role",
  contracts: "contact-contracts",
  trackingMethod: "contact-tracking-method",
  pain: "contact-pain",
  preference: "contact-preference",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(data: FormData): Record<string, string> {
  const errs: Record<string, string> = {};
  const required = (key: string, msg: string) => {
    if (!String(data.get(key) ?? "").trim()) errs[key] = msg;
  };
  required("name", "Enter your name.");
  const email = String(data.get("email") ?? "").trim();
  if (!email) errs.email = "Enter your work email.";
  else if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address.";
  required("company", "Enter your company.");
  required("role", "Enter your role.");
  required("contracts", "Select a range.");
  required("trackingMethod", "Select how you track today.");
  required("pain", "Describe the main tracking pain.");
  required("preference", "Choose a follow-up preference.");
  return errs;
}
