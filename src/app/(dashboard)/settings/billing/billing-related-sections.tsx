import { Suspense } from "react";
import { BillingActivityFeed } from "@/components/settings/billing-activity-feed";
import { BillingInvoicesList } from "@/components/settings/billing-invoices-list";
import type { BillingPageData } from "./billing-page-model";
import { BillingFaqSection } from "./billing-faq-section";

function BillingListFallback({ width = "w-32" }: { width?: string }) {
  return (
    <section className="ui-card ui-loading-panel p-0">
      <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-4">
        <span aria-hidden className={`ui-skeleton h-5 ${width} rounded`} />
      </div>
      <ul className="px-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="py-3">
            <span aria-hidden className="ui-skeleton h-4 w-full rounded" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BillingInvoicesAndFaqGrid({ data }: { data: BillingPageData }) {
  const showInvoices = Boolean(data.org.stripeCustomerId && data.isAdmin && data.stripeConfigured);
  return (
    <div className={`grid gap-4 ${showInvoices ? "lg:grid-cols-2 lg:items-start" : ""}`}>
      {showInvoices ? (
        <Suspense fallback={<BillingListFallback />}>
          <BillingInvoicesList customerId={data.org.stripeCustomerId as string} />
        </Suspense>
      ) : null}
      <BillingFaqSection />
    </div>
  );
}

export function BillingActivitySection({ data }: { data: BillingPageData }) {
  if (!data.org.stripeCustomerId || !data.isAdmin || !data.stripeConfigured) return null;
  return (
    <Suspense fallback={<BillingListFallback width="w-40" />}>
      <BillingActivityFeed customerId={data.org.stripeCustomerId} />
    </Suspense>
  );
}
