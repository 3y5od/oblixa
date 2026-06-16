import type { Metadata } from "next";
import {
  BookOpen,
  CreditCard,
  Download,
  FileText,
  Files,
  KeyRound,
  Landmark,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import {
  LegalContactBand,
  LegalEditorialShell,
  LegalFooter,
  LegalHeader,
  LegalLedger,
  LegalSection,
} from "@/components/landing/legal/legal-editorial";
import { ActionChip } from "@/components/ui/action-chip";
import * as terms from "./terms-content";

export const metadata: Metadata = {
  title: terms.title,
  description: terms.description,
  alternates: { canonical: "/terms" },
  openGraph: { title: terms.title, description: terms.description, url: "/terms", type: "article" },
  twitter: { card: "summary_large_image", title: terms.title, description: terms.description },
};

export default function TermsPage() {
  return (
    <>
      <LegalPageJsonLd path="/terms" title={terms.title} description={terms.description} />
      <LegalEditorialShell anchors={terms.ANCHORS}>
        <LegalHeader
          eyebrow="Service terms"
          title="Terms of use"
          icon={FileText}
          lastReviewedIso={terms.LAST_REVIEWED_ISO}
          lastReviewedLabel={terms.LAST_REVIEWED_DISPLAY}
          lastReviewedPrefix="Last updated"
          facts={terms.HEADER_FACTS}
          related={terms.HEADER_LINKS}
          lead={
            <>
              These terms are a general, public-facing summary for teams evaluating Oblixa. Binding
              commercial terms for your organization may be set out in a separate agreement, order
              form, or online checkout flow, and those controlling terms take precedence over this
              summary. Have qualified counsel review any contract before you rely on it.
            </>
          }
        />

        <LegalSection id="using" eyebrow="Service scope" title="Using Oblixa" icon={BookOpen}>
          <p className="max-w-2xl text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
            Oblixa is a workspace for signed-contract follow-up — reviewing key details, assigning
            owners, tracking renewal and notice dates, tracking contract requirements, requesting
            evidence, and exporting reports. It does not draft, negotiate, or sign agreements, and it
            does not make decisions for you. Use it only for agreements your organization is
            authorized to track.
          </p>
        </LegalSection>

        <LegalSection
          id="accounts"
          eyebrow="Accounts and access"
          title="Accounts and workspace access"
          icon={KeyRound}
        >
          <LegalLedger
            caption="Access and responsibility"
            rows={terms.ACCOUNT_FACTS.map((fact) => ({ label: fact.k, value: fact.v }))}
          />
        </LegalSection>

        <LegalSection
          id="billing"
          eyebrow="Billing"
          title="Billing and paid continuation"
          icon={CreditCard}
        >
          <LegalLedger
            caption="Paid Core plan"
            rows={terms.BILLING_FACTS.map((fact) => ({ label: fact.k, value: fact.v }))}
          />
        </LegalSection>

        <LegalSection
          id="acceptable-use"
          eyebrow="Acceptable use"
          title="Use the service responsibly"
          icon={ShieldCheck}
        >
          <p className="max-w-2xl text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
            Don&apos;t misuse the service — including attempting to reach workspaces you are not
            authorized for, probing it in ways that harm availability or security, scraping or
            reselling it, or uploading unlawful content. Each workspace is responsible for its
            members&apos; actions.
          </p>
          <div className="mt-3.5">
            <ActionChip verb="Read the acceptable use policy" href="/acceptable-use" />
          </div>
        </LegalSection>

        <LegalSection
          id="content"
          eyebrow="Your data"
          title="Customer content and contract files"
          icon={Files}
        >
          <p className="max-w-2xl text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
            You keep ownership of the agreements, files, and data you upload, and you confirm you
            have the right to store and process them in your workspace. Workspace data is scoped to
            your organization and visible by role. Don&apos;t upload regulated data classes without a
            written addendum that covers them.
          </p>
        </LegalSection>

        <LegalSection id="ai" eyebrow="AI and review" title="AI-assisted suggestions" icon={Sparkles}>
          <p className="max-w-2xl text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
            Where you use extraction, uploaded contract text may be sent to our AI provider only to
            suggest contract details. Each suggestion stays tied to a source snippet and remains a
            suggested detail until a person on your team reviews it. Oblixa does not guarantee
            extraction accuracy, and suggested details are not trusted data until reviewed.
          </p>
        </LegalSection>

        <LegalSection
          id="exports"
          eyebrow="Portability"
          title="Exports and deletion"
          icon={Download}
        >
          <LegalLedger
            caption="Get your data out"
            rows={terms.EXPORT_FACTS.map((fact) => ({ label: fact.k, value: fact.v }))}
          />
        </LegalSection>

        <LegalSection id="changes" eyebrow="Updates" title="Changes to these terms" icon={RefreshCw}>
          <p className="max-w-2xl text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
            We may update these terms. Material changes to customer agreements are handled through
            the channel that governs your subscription — for example, updated terms presented in the
            product or through your vendor process. Continued use after an update means you accept the
            revised terms.
          </p>
        </LegalSection>

        <LegalSection
          id="disclaimers"
          tone="note"
          eyebrow="Legal note"
          title="Disclaimers and limits"
          icon={Scale}
        >
          <p className="max-w-2xl text-[13px] leading-[1.6] text-[var(--text-secondary)]">
            Oblixa helps teams run signed-contract follow-up. It does not provide legal advice, legal
            analysis, or a substitute for qualified counsel, and it is provided without warranties
            beyond those required by law. You remain responsible for your agreements, compliance
            obligations, and decisions.
          </p>
        </LegalSection>

        <LegalSection
          id="governing"
          tone="note"
          eyebrow="Precedence"
          title="Governing terms"
          icon={Landmark}
        >
          <p className="max-w-2xl text-[13px] leading-[1.6] text-[var(--text-secondary)]">
            Where a separate signed agreement, order form, or checkout governs your subscription,
            that agreement controls and overrides this public summary. Governing law and venue follow
            the controlling agreement; if none applies, the standard terms presented at sign-up
            govern. This page does not create rights beyond your executed terms.
          </p>
        </LegalSection>

        <LegalContactBand
          id="contact"
          eyebrow="Questions"
          title="Terms, billing, or access questions"
          body="Reach us asynchronously about these terms, billing, or workspace access and we'll route it to the right place."
          actions={<ActionChip verb="Contact Oblixa" href="/contact" />}
        />

        <LegalFooter
          links={terms.FOOTER_LINKS}
          note={
            <>
              Oblixa is a workspace for signed-contract follow-up, not a law firm. Last updated{" "}
              <time dateTime={terms.LAST_REVIEWED_ISO}>{terms.LAST_REVIEWED_DISPLAY}</time>.
            </>
          }
        />
      </LegalEditorialShell>
    </>
  );
}
