import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ExternalSubmitForm } from "@/components/external/external-submit-form";

export default async function ExternalActionPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  return (
    <main className="landing-luminous relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-16 outline-none sm:px-6">
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      <div aria-hidden className="landing-luminous__grid" />
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3 no-underline transition-opacity hover:opacity-85">
            <span className="ui-avatar-tile h-11 w-11 text-[var(--accent-fg)] shadow-[var(--shadow-2)] [background:linear-gradient(180deg,color-mix(in_oklab,var(--accent)_76%,white),var(--accent-strong))]">
              O
            </span>
            <span
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, var(--text-primary) 0%, color-mix(in oklab, var(--text-primary) 68%, var(--accent-strong)) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                letterSpacing: "-0.015em",
              }}
            >
              Oblixa
            </span>
          </Link>
          <p className="mt-5">
            <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              External action
            </span>
          </p>
          <h1 className="mx-auto mt-3 max-w-[28ch] text-pretty text-[1.5rem] font-semibold tracking-tight text-[var(--text-primary)] sm:mt-4 sm:text-[1.75rem]">
            Complete your requested action
          </h1>
        </div>

        <div className="landing-card-premium relative overflow-hidden rounded-2xl border p-6 sm:p-8">
          <div
            aria-hidden
            className="landing-corner-ring"
            style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
          />
          <ExternalSubmitForm token={token} />

          <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-[var(--border-subtle)] pt-4 text-[11px] text-[var(--text-tertiary)]">
            <ShieldCheck className="h-3 w-3 text-[var(--accent-strong)]" aria-hidden />
            <span>Encrypted in transit · Scoped to this link</span>
          </div>
        </div>
      </div>
    </main>
  );
}
