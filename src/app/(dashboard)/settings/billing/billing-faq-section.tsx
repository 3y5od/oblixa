import Link from "next/link";
import { ChevronRight, Mail, HelpCircle } from "lucide-react";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import { FAQ_ICONS } from "./billing-page-primitives";

export function BillingFaqSection() {
  return (
    <section className="ui-card p-0" aria-labelledby="billing-faq-title">
      <header className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
        <p className="ui-caps-1 text-[var(--accent)]">FAQ</p>
        <h2 id="billing-faq-title" className="mt-1 text-[1.05rem] font-semibold text-[var(--text-primary)]">
          Common billing questions
        </h2>
      </header>
      <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] px-5 py-2">
        {SETTINGS_BILLING_STRINGS.faq.map((question, idx) => {
          const answer = (SETTINGS_BILLING_STRINGS.faqAnswers as Record<string, string>)[question];
          const total = SETTINGS_BILLING_STRINGS.faq.length;
          const Icon = FAQ_ICONS[question] ?? HelpCircle;
          return (
            <details key={question} name="billing-faq" className="ui-billing-faq group">
              <summary
                className="ui-billing-faq-summary flex min-h-[44px] cursor-pointer list-none items-center gap-3 py-3 outline-none transition-colors marker:hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden"
                aria-label={`Question ${idx + 1} of ${total}: ${question}`}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-[var(--accent-strong)]">
                  <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 items-center text-[13.5px] font-semibold text-[var(--text-primary)]">
                  {question}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-90 group-hover:text-[var(--text-secondary)]" strokeWidth={1.85} aria-hidden />
              </summary>
              <div className="py-3 pl-10 pr-2">
                <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">{answer}</p>
              </div>
            </details>
          );
        })}
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] px-5 py-4">
        <span className="mr-1 text-[12.5px] text-[var(--text-secondary)]">{SETTINGS_BILLING_STRINGS.contactSalesPromptSpec}</span>
        <Link href={SETTINGS_BILLING_STRINGS.contactSalesHref} className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]">
          <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          {SETTINGS_BILLING_STRINGS.contactSalesCta}
        </Link>
        <Link href={SETTINGS_BILLING_STRINGS.publicPricingHref} className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]">
          {SETTINGS_BILLING_STRINGS.publicPricingLink}
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </Link>
      </footer>
    </section>
  );
}
