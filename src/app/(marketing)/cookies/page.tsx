import type { Metadata } from "next";
import { Cookie, Cog, ShieldCheck } from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Cookies — Oblixa";
const description =
  "How Oblixa uses cookies and similar technologies for sign-in, security, and essential product operation.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/cookies" },
  openGraph: { title, description, url: "/cookies", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function CookiesPage() {
  return (
    <>
      <LegalPageJsonLd path="/cookies" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <article className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-7 sm:p-10">
            <div className="flex items-start gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <Cookie className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Cookie policy
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  Cookies
                </h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Storage we set so the product can authenticate and stay secure.
                </p>
              </div>
            </div>

            <p className="mt-8 text-sm leading-relaxed text-[var(--text-secondary)]">
              Like most web applications, Oblixa uses cookies and similar storage to keep you signed in,
              protect sessions, and operate core security controls. Marketing pages on this site do not add
              third-party advertising cookies as part of this implementation.
            </p>

            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              If your organization introduces additional analytics or marketing scripts, update this page and
              your consent approach to match what is actually deployed.
            </p>

            <div className="mt-10 space-y-7">
              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Essential cookies</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    We set cookies required for authentication, CSRF protection, and core security workflows.
                    These cookies are not used to track you across sites.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Cog className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Managing cookies</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    You can control cookies through browser settings. Clearing cookies may sign you out of the
                    product until you authenticate again.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
