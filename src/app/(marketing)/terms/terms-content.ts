export const title = "Terms of use — Oblixa";
export const description =
  "How Oblixa's terms of use work: reviewed access, the paid Core plan, workspace responsibilities, customer content, AI-assisted suggestions, and the no-legal-advice boundary.";

export const LAST_REVIEWED_ISO = "2026-05-28";
export const LAST_REVIEWED_DISPLAY = "May 28, 2026";

export const SUMMARY_FACTS = [
  "Reviewed access",
  "Paid Core plan",
  "Workspace responsibility",
  "No legal advice",
] as const;

export const ANCHORS = [
  { id: "using", label: "Using Oblixa" },
  { id: "accounts", label: "Accounts & access" },
  { id: "billing", label: "Billing" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "content", label: "Customer content" },
  { id: "ai", label: "AI suggestions" },
  { id: "exports", label: "Exports & deletion" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "changes", label: "Changes" },
  { id: "governing", label: "Governing terms" },
  { id: "contact", label: "Contact" },
] as const;

export const HEADER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/contact", label: "Contact" },
] as const;

export const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

export const ACCOUNT_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Access", v: "By approved request or workspace invite" },
  { k: "Account creation", v: "Gated by a valid grant or invite" },
  { k: "Credentials", v: "You safeguard your own sign-in" },
  { k: "Admins", v: "Responsible for their team's use" },
  { k: "Suspected misuse", v: "Notify your admin and Oblixa" },
];

export const BILLING_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Core plan", v: "$249/month per workspace" },
  { k: "Term", v: "Month-to-month" },
  { k: "When charged", v: "After access approval and explicit checkout" },
  { k: "Included", v: "Up to 500 contracts and 10 users" },
  { k: "Cancellation", v: "Effective at the end of the paid period" },
  { k: "Refunds", v: "No prorated refunds by default" },
];

export const EXPORT_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Export", v: "Contract records and reports as CSV" },
  { k: "Deletion", v: "Workspace data deletion on request" },
  { k: "Report files", v: "Download links expire after 7 days" },
  { k: "After deletion", v: "Removed within 30 days of the recovery window" },
];
