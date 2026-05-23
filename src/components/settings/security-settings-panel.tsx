"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Check,
  ChevronRight,
  Copy,
  KeyRound,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { formatDate, timeAttrs, fmtRelative } from "@/lib/format/date";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { LiveRegion } from "@/components/ui/live-region";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiAlert } from "@/components/ui/ui-alert";
import { UiConfirmDialog } from "@/components/ui/ui-confirm-dialog";
import { UiToggle } from "@/components/ui/ui-toggle";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import {
  startTotpEnrollment,
  unenrollTotpFactor,
  updateOrganizationMfaRequired,
  verifyTotpEnrollment,
  type MfaActionResult,
  type MfaActionError,
} from "@/actions/mfa";
import { revokeOtherSessions } from "@/actions/sessions";
import { mutateJson } from "@/lib/http/client-json";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/security-page-v2-pass.md — v2 pass on top of maximal-pass
// scaffold. Addresses §1.2 (drop in-card MFA badge), §1.8/§1.17/§1.19
// (empty-state branching), §1.20 (count surfacing), §1.24 (primary CTA
// in card), §1.26 (32px medallions), §1.27 (placeholder), §1.31
// (sessions row pattern), §1.34 (status labels), §1.47 (sign-out
// current), §1.51 (max-factors hint), §1.52 (focus restoration),
// §1.55 (idempotency key), §3.4 (Sessions+Workspace 2-col), §3.9
// (offline UI), §5.9 (SR transition), §5.10 (aria-current), §6.1
// (?mfa=enrolled redirect), §6.2 (optimistic step-up), §6.5 (multi-tab
// race comment).

export type TotpFactorRow = {
  id: string;
  status: string;
  friendly_name: string | null;
};

export type SessionRow = {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string | null;
  // V4 §1.2 — surface expiry context for the current session.
  expiresAt: string | null;
};

type Props = {
  orgId: string;
  role: string;
  orgMfaRequired: boolean;
  totpFactors: TotpFactorRow[];
  currentAal: string | null;
  nextAal: string | null;
  stepUp: {
    active: boolean;
    via: "password" | "aal2" | null;
    expiresAt: number | null;
  };
  sessions: SessionRow[];
};

function isError(r: MfaActionResult): r is MfaActionError {
  return r != null && typeof r === "object" && "error" in r;
}


// V2 §1.26 — canonical 32px medallion shell. Down from 40px on
// sub-cards to ease visual density (page-header keeps 40px).
function CardMedallion({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
    >
      {children}
    </span>
  );
}

// V2 §1.19 — danger-tinted medallion when org-MFA required + factors === 0.
function DangerMedallion({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--danger-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_30%,var(--surface-raised))] text-[var(--danger-ink)] shadow-[var(--shadow-1)]"
    >
      {children}
    </span>
  );
}

export function SecuritySettingsPanel({
  orgId,
  role,
  orgMfaRequired,
  totpFactors: initialFactors,
  currentAal,
  stepUp,
  sessions,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsStepUpPrompt, setNeedsStepUpPrompt] = useState(false);
  const [factors, setFactors] = useState(initialFactors);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [orgMfa, setOrgMfa] = useState(orgMfaRequired);
  const [orgMfaConfirmOpen, setOrgMfaConfirmOpen] = useState(false);
  const [pendingOrgMfaValue, setPendingOrgMfaValue] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; idx: number } | null>(null);
  const [stepUpPending, setStepUpPending] = useState(false);
  // V2 §6.2 optimistic step-up: client-only override of server prop.
  const [optimisticStepUpActive, setOptimisticStepUpActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  // V2 §3.9 offline detection.
  const [isOnline, setIsOnline] = useState(true);
  // V2 §1.55 idempotency key for noscript fallback form.
  // Stable across renders so refresh-replay submits same key.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const enrollHeadingRef = useRef<HTMLHeadingElement | null>(null);
  // V2 §1.52 — focus restoration helper. AsyncActionButton doesn't
  // forward refs, so we focus by id at restoration time.
  const ADD_AUTH_BTN_ID = "mfa-add-authenticator-btn";
  const stepUpHelpId = useId();
  const totpHintId = useId();
  const totpErrorId = useId();
  const orgMfaToggleId = useId();
  // V2 §5.9 SR transition announcement.
  const prevFactorCountRef = useRef<number>(initialFactors.length);

  const qrSrc = useMemo(() => {
    if (!enroll?.qrCode) return null;
    return enroll.qrCode.startsWith("data:")
      ? enroll.qrCode
      : `data:image/svg+xml;utf-8,${encodeURIComponent(enroll.qrCode)}`;
  }, [enroll]);

  const isAdmin = role === "admin";
  const factorCount = factors.length;
  const factorsEmpty = factorCount === 0;
  // V2 §1.19 — branch the empty-state medallion + body on org policy.
  const showDangerEmptyState = factorsEmpty && orgMfaRequired;

  // V2 §6.5 — multi-tab race: tab A initiates step-up, tab B reads
  // stale state. The server-side hasSensitiveActionProof is the
  // source of truth on the next mutation. Acceptable trade-off.
  const stepUpActive = optimisticStepUpActive || stepUp.active;

  // V2 §1.34 + §2.6 — step-up badge label varies by via.
  let stepUpLabel: string;
  let stepUpTone: "healthy" | "warning" | "empty";
  if (stepUpActive && stepUp.via === "aal2") {
    stepUpLabel = SETTINGS_SECURITY_STRINGS.stepUpMfaSessionLabel;
    stepUpTone = "healthy";
  } else if (stepUpActive) {
    stepUpLabel = SETTINGS_SECURITY_STRINGS.stepUpActiveLabel;
    stepUpTone = "healthy";
  } else {
    stepUpLabel = SETTINGS_SECURITY_STRINGS.stepUpEmptyLabel;
    stepUpTone = "empty";
  }

  // V2 §9.18 focus the QR section heading when enrollment populates.
  useEffect(() => {
    if (enroll && enrollHeadingRef.current) {
      enrollHeadingRef.current.focus();
    }
  }, [enroll]);

  // V2 §3.9 detect offline state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // V2 §5.9 — announce factor-count transitions to SR.
  useEffect(() => {
    const prev = prevFactorCountRef.current;
    if (prev === 0 && factors.length >= 1) {
      setMessage("Authenticator enrolled. Workspace now protected by two-factor.");
    } else if (prev >= 1 && factors.length === 0) {
      setMessage("All authenticators removed. Single-factor only.");
    }
    prevFactorCountRef.current = factors.length;
  }, [factors.length]);

  function handleActionResult(r: MfaActionResult, successMsg: string) {
    if (isError(r)) {
      setError(r.error);
      // V2 §1.51 — max-factors hint.
      if (/max.*factor/i.test(r.error)) {
        setError(
          `${r.error} ${SETTINGS_SECURITY_STRINGS.enrollMaxFactorsHint}`
        );
      }
      if (r.needStepUp) {
        setNeedsStepUpPrompt(true);
        const el = document.getElementById("step-up-card");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        const pwInput = document.getElementById("stepup-pass") as HTMLInputElement | null;
        setTimeout(() => pwInput?.focus(), 350);
      }
      return false;
    }
    setMessage(successMsg);
    setNeedsStepUpPrompt(false);
    return true;
  }

  async function onStepUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setStepUpPending(true);
    try {
      const result = await mutateJson<{ error?: string; retryAfterMs?: number }>(
        "/api/settings/step-up",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // V2 §1.55 idempotency for JS path as well.
            "x-idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({ password }),
        }
      );
      if (!result.ok) {
        const isRateLimit =
          typeof result.message === "string" &&
          (result.message.toLowerCase().includes("rate") ||
            result.message.toLowerCase().includes("too many"));
        setError(
          isRateLimit
            ? SETTINGS_SECURITY_STRINGS.rateLimitedCopy
            : result.message || "Could not verify password"
        );
        return;
      }
      setPassword("");
      setNeedsStepUpPrompt(false);
      // V2 §6.2 optimistic update so badge flips immediately.
      setOptimisticStepUpActive(true);
      setMessage("Step-up confirmed for ~10 minutes. Sensitive actions are unlocked.");
    } finally {
      setStepUpPending(false);
    }
  }

  async function copyManualKey(secret: string) {
    if (!navigator.clipboard) {
      setCopyFallback(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      setCopyFallback(true);
    }
  }

  const liveMsg =
    pending && removeConfirm
      ? "Removing authenticator…"
      : pending && enroll
        ? "Verifying authenticator…"
        : pending
          ? "Updating security setting…"
          : stepUpPending
            ? "Verifying password…"
            : error ?? message ?? undefined;

  // V2 §1.20 — surface enrolled count via KeyValueChip beside MFA h2.
  const showEnrolledCount = factorCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <LiveRegion message={liveMsg} politeness={error ? "assertive" : "polite"} />

      {/* V2 §3.9 offline UiAlert. */}
      {!isOnline ? (
        <UiAlert tone="warning">
          {SETTINGS_SECURITY_STRINGS.offlineCopy}
        </UiAlert>
      ) : null}

      {/* V2 §3.1 + §7.1 — MFA + Step-up paired in 2-col grid. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* === MFA card === */}
        {/* V4 §1.7 — conditional warning border when factorsEmpty
            surfaces an in-card tone signal (the metaStrip is the
            at-glance scan; this is the card-body presence). */}
        <section
          id="mfa-card"
          aria-busy={pending && (enroll != null || pendingFactorId != null)}
          className={`ui-card p-0 ${factorsEmpty ? "border-[color:color-mix(in_oklab,var(--warning-soft)_55%,var(--border-subtle))]" : ""}`}
        >
          <header className="flex items-start justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
            <div className="flex min-w-0 items-start gap-3">
              {/* V4 §1.9 — MFA medallion uses ShieldCheck (vs STEP-UP
                  KeyRound) for visual identity differentiation. */}
              <CardMedallion>
                <ShieldCheck className="h-4 w-4" strokeWidth={1.85} />
              </CardMedallion>
              <div className="min-w-0">
                <p className="ui-caps-1 text-[var(--accent)]">
                  <span className="">
                    {SETTINGS_SECURITY_STRINGS.eyebrows.mfa}
                  </span>
                </p>
                <h2
                  id="mfa-card-title"
                  className="mt-1 text-[1.05rem] font-semibold tracking-tight leading-tight text-[var(--text-primary)] sm:text-[1.4rem]"
                >
                  {SETTINGS_SECURITY_STRINGS.sections.mfa}
                </h2>
              </div>
            </div>
            {/* V2 §1.2 — card-level MFA badge DROPPED to avoid duplicate
                count with metaStrip. §1.20 surfaces a count chip when
                factors > 0. V4 user-report §4 — shrink-0 anchors right. */}
            {showEnrolledCount ? (
              <KeyValueChip
                label="ENROLLED"
                value={factorCount}
                tone="success"
              />
            ) : null}
          </header>

          <div
            className={`flex-1 px-5 py-5 ${showDangerEmptyState ? "bg-[color:color-mix(in_oklab,var(--danger-soft)_18%,var(--surface-raised))]" : ""}`}
          >
            <InlineMutationStatus
              message={error ?? message}
              variant={error ? "error" : "success"}
              className="mb-3 text-sm"
            />

            {factorsEmpty ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* V2 §1.17 — distinct icon (Smartphone) from header (KeyRound). */}
                  {showDangerEmptyState ? (
                    <DangerMedallion>
                      <Smartphone className="h-4 w-4" strokeWidth={1.85} />
                    </DangerMedallion>
                  ) : (
                    <CardMedallion>
                      <Smartphone className="h-4 w-4" strokeWidth={1.85} />
                    </CardMedallion>
                  )}
                  <p className="ui-caps-1 text-[var(--text-tertiary)]">
                    {SETTINGS_SECURITY_STRINGS.mfaEmptyLabel}
                  </p>
                </div>
                {/* V2 §1.19 — branch body on org policy. */}
                {showDangerEmptyState ? (
                  <p className="text-[13px] text-[var(--danger-ink)]">
                    {SETTINGS_SECURITY_STRINGS.mfaEmptyBodyRequired}
                  </p>
                ) : null}
                {/* V2 §1.8 — drop the redundant prose body in optional
                    state; badge + caps label already communicate. */}
              </div>
            ) : (
              <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
                {factors.map((f, idx) => (
                  <li
                    key={f.id}
                    aria-busy={pendingFactorId === f.id}
                    className="group flex flex-wrap items-center gap-3 py-3"
                  >
                    {/* V2 §10.9 reserved tone-dot slot. */}
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          f.status === "verified"
                            ? "var(--success-ink)"
                            : "var(--warning-ink)",
                      }}
                    />
                    <span className="min-w-0 flex-1 text-[13.5px] text-[var(--text-primary)]">
                      {f.friendly_name ??
                        SETTINGS_SECURITY_STRINGS.factorFallbackName(idx)}
                    </span>
                    <StatusBadge
                      status={f.status === "verified" ? "healthy" : "warning"}
                    >
                      {f.status.toUpperCase()}
                    </StatusBadge>
                    <button
                      type="button"
                      className="ui-btn-secondary inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] billing-no-print"
                      disabled={pending}
                      aria-label={`Remove authenticator ${f.friendly_name ?? idx + 1}`}
                      onClick={() => setRemoveConfirm({ id: f.id, idx })}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!enroll ? (
              // V2 §1.24 — promote in-card button to primary when empty.
              <AsyncActionButton
                id={ADD_AUTH_BTN_ID}
                type="button"
                className={`${factorsEmpty ? "ui-btn-primary" : "ui-btn-secondary"} mt-4 inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm billing-no-print`}
                pending={pending}
                pendingLabel="Preparing…"
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    setMessage(null);
                    const r = await startTotpEnrollment();
                    if ("error" in r) {
                      const errMsg = typeof r.error === "string" ? r.error : "Request failed";
                      setError(
                        /max.*factor/i.test(errMsg)
                          ? `${errMsg} ${SETTINGS_SECURITY_STRINGS.enrollMaxFactorsHint}`
                          : errMsg
                      );
                      return;
                    }
                    setEnroll({ factorId: r.factorId, qrCode: r.qrCode, secret: r.secret });
                  })
                }
              >
                Enroll authenticator
              </AsyncActionButton>
            ) : (
              <div
                role="region"
                aria-live="polite"
                aria-label="Authenticator enrollment"
                className="mt-4 space-y-4"
              >
                <h3
                  ref={enrollHeadingRef}
                  tabIndex={-1}
                  className="ui-caps-2 text-[var(--text-tertiary)] outline-none"
                >
                  ENROLL AUTHENTICATOR
                </h3>
                {qrSrc ? (
                  <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrSrc}
                      alt={SETTINGS_SECURITY_STRINGS.qrAlt}
                      className="h-40 w-40 object-contain sm:h-48 sm:w-48"
                    />
                  </div>
                ) : null}

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ui-caps-3 text-[var(--text-tertiary)]">
                      {SETTINGS_SECURITY_STRINGS.manualKeyEyebrow}
                    </span>
                    <span className="ui-caps-3 text-[var(--warning-ink)]">
                      {SETTINGS_SECURITY_STRINGS.manualKeyWarning}
                    </span>
                    <button
                      type="button"
                      className="ui-btn-ghost ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] billing-no-print"
                      onClick={() => copyManualKey(enroll.secret)}
                    >
                      {copiedSecret ? (
                        <>
                          <Check className="h-3 w-3 text-[var(--success-ink)]" aria-hidden />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 opacity-60" aria-hidden />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 font-mono break-all text-[12px] text-[var(--text-secondary)]">
                    {enroll.secret}
                  </p>
                  {copyFallback ? (
                    <p className="ui-caps-3 mt-1 text-[var(--warning-ink)]">
                      PRESS CTRL+C / ⌘C TO COPY
                    </p>
                  ) : null}
                </div>

                <form
                  noValidate
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    startTransition(async () => {
                      setError(null);
                      setVerifyError(null);
                      const r = await verifyTotpEnrollment({
                        factorId: enroll.factorId,
                        code,
                      });
                      if ("error" in r) {
                        setVerifyError(r.error ?? "Request failed");
                        return;
                      }
                      setFactors((prev) => [
                        ...prev,
                        {
                          id: enroll.factorId,
                          status: "verified",
                          friendly_name: "Authenticator app",
                        },
                      ]);
                      setEnroll(null);
                      setCode("");
                      // V2 §6.1 — redirect with ?mfa=enrolled so the
                      // page banner state machine renders success.
                      router.push("/settings/security?mfa=enrolled");
                    });
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <label htmlFor="totp-code" className="ui-label">
                      Verification code
                    </label>
                    <input
                      id="totp-code"
                      className={`ui-input mt-1 w-full ${verifyError ? "ui-input-error" : ""}`}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="\d{6}"
                      aria-invalid={!!verifyError}
                      aria-describedby={verifyError ? totpErrorId : totpHintId}
                      value={code}
                      onChange={(ev) => setCode(ev.target.value)}
                    />
                    {verifyError ? (
                      <p
                        id={totpErrorId}
                        className="ui-caps-3 mt-1 text-[var(--danger-ink)]"
                      >
                        {verifyError}
                      </p>
                    ) : (
                      <p
                        id={totpHintId}
                        className="ui-caps-3 mt-1 text-[var(--text-tertiary)]"
                      >
                        {SETTINGS_SECURITY_STRINGS.totpCodeHint}
                      </p>
                    )}
                  </div>
                  <AsyncActionButton
                    type="submit"
                    className="ui-btn-primary inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm billing-no-print"
                    pending={pending}
                    pendingLabel="Confirming…"
                  >
                    Confirm
                  </AsyncActionButton>
                </form>
                <button
                  type="button"
                  className="ui-btn-ghost inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] text-[var(--text-tertiary)] billing-no-print"
                  onClick={() => {
                    setEnroll(null);
                    setVerifyError(null);
                    // V2 §1.52 — restore focus to the trigger button.
                    setTimeout(() => {
                      const btn = document.getElementById(
                        ADD_AUTH_BTN_ID
                      ) as HTMLButtonElement | null;
                      btn?.focus();
                    }, 50);
                  }}
                >
                  {SETTINGS_SECURITY_STRINGS.enrollmentCancelCta}
                </button>
              </div>
            )}

            {/* V4 §6.1 — "What is two-factor sign-in?" disclosure
                beneath MFA empty state. Resolves §1.3 height
                asymmetry + adds UX value for non-technical admins.
                §6 disclosure pattern: native <details> with
                marker:hidden + rotating ChevronRight. */}
            {factorsEmpty && !enroll ? (
              <details className="group mt-4">
                <summary className="ui-caps-3 inline-flex cursor-pointer items-center gap-1.5 text-[var(--text-tertiary)] marker:hidden [&::-webkit-details-marker]:hidden">
                  {SETTINGS_SECURITY_STRINGS.mfaExplainerSummary}
                  <ChevronRight
                    className="h-3 w-3 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  {SETTINGS_SECURITY_STRINGS.mfaExplainerBody}
                </p>
              </details>
            ) : null}
          </div>
        </section>

        {/* === Step-up card === */}
        <section
          id="step-up-card"
          aria-busy={stepUpPending}
          className="ui-card p-0"
        >
          <header className="flex items-start justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
            <div className="flex min-w-0 items-start gap-3">
              <CardMedallion>
                <KeyRound className="h-4 w-4" strokeWidth={1.85} />
              </CardMedallion>
              <div className="min-w-0">
                <p className="ui-caps-1 text-[var(--accent)]">
                  <span className="">
                    {SETTINGS_SECURITY_STRINGS.eyebrows.stepUp}
                  </span>
                </p>
                <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight leading-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                  {SETTINGS_SECURITY_STRINGS.sections.stepUp}
                </h2>
              </div>
            </div>
            <span className="shrink-0">
              <StatusBadge status={stepUpTone}>{stepUpLabel}</StatusBadge>
            </span>
          </header>

          <div className="px-5 py-5">
            {stepUp.via === "aal2" && !optimisticStepUpActive ? (
              <p className="ui-caps-3 mb-3 text-[var(--success-ink)]">
                {SETTINGS_SECURITY_STRINGS.stepUpAal2Note}
              </p>
            ) : null}

            {needsStepUpPrompt ? (
              <p className="mb-3 text-[12.5px] text-[var(--warning-ink)]">
                {SETTINGS_SECURITY_STRINGS.stepUpRequiredPrompt}
              </p>
            ) : null}

            {/* V2 §1.25 + §1.55 noscript form-action fallback with
                hidden idempotency_key input. */}
            <noscript>
              <form
                action="/api/settings/step-up"
                method="POST"
                className="flex max-w-sm flex-col gap-3"
              >
                <input
                  type="hidden"
                  name="idempotency_key"
                  value={idempotencyKey}
                />
                <label htmlFor="stepup-pass-ns" className="ui-label">
                  Account password
                </label>
                <input
                  id="stepup-pass-ns"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="ui-input"
                  placeholder={SETTINGS_SECURITY_STRINGS.passwordPlaceholder}
                />
                <button type="submit" className="ui-btn-primary rounded-full px-4 py-2 text-sm">
                  {SETTINGS_SECURITY_STRINGS.stepUpFormCta}
                </button>
              </form>
            </noscript>

            <form
              noValidate
              onSubmit={onStepUp}
              className="flex max-w-sm flex-col gap-3 billing-no-print"
            >
              <div>
                <label htmlFor="stepup-pass" className="ui-label">
                  Account password
                </label>
                <input
                  id="stepup-pass"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="ui-input mt-1 w-full"
                  placeholder={SETTINGS_SECURITY_STRINGS.passwordPlaceholder}
                  aria-describedby={stepUpHelpId}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p
                  id={stepUpHelpId}
                  className="mt-1 text-[12.5px] leading-snug text-[var(--text-secondary)]"
                >
                  {SETTINGS_SECURITY_STRINGS.stepUpFormHelp}
                </p>
              </div>
              <AsyncActionButton
                type="submit"
                className="ui-btn-primary inline-flex w-full items-center gap-1 rounded-full px-4 py-2 text-sm sm:w-auto sm:self-start"
                pending={stepUpPending}
                pendingLabel="Confirming…"
              >
                {SETTINGS_SECURITY_STRINGS.stepUpFormCta}
              </AsyncActionButton>
              {/* V3 §1.22 — Forgot password tertiary link. */}
              <Link
                href="/auth/forgot-password"
                className="ui-link text-[12.5px] text-[var(--text-tertiary)] billing-no-print"
              >
                {SETTINGS_SECURITY_STRINGS.forgotPasswordCta}
              </Link>
            </form>
          </div>
        </section>
      </div>

      {/* V2 §3.4 — Sessions + Workspace MFA in 2-col grid at lg+. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* === Sessions card === */}
        <section className="ui-card p-0">
          <header className="flex items-start justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
            <div className="flex min-w-0 items-start gap-3">
              <CardMedallion>
                <Smartphone className="h-4 w-4" strokeWidth={1.85} />
              </CardMedallion>
              <div className="min-w-0">
                <p className="ui-caps-1 text-[var(--accent)]">
                  <span className="">
                    {SETTINGS_SECURITY_STRINGS.eyebrows.sessions}
                  </span>
                </p>
                <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight leading-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                  {SETTINGS_SECURITY_STRINGS.sections.sessions}
                  {/* V4 user-report §2 — count chip dropped when
                      sessions.length === 1: the THIS DEVICE row
                      below already conveys the count, and a single
                      digit in a rounded-full border reads as a
                      notification badge, not a count. When future
                      Supabase versions return multi-device data
                      (sessions.length > 1), surface as compact caps:
                      "2 DEVICES" tabular-nums. */}
                  {sessions.length > 1 ? (
                    <span className="ml-2 ui-caps-3 font-normal text-[var(--text-tertiary)] tabular-nums">
                      {sessions.length} DEVICES
                    </span>
                  ) : null}
                </h2>
              </div>
            </div>
          </header>
          <div className="px-5 py-5">
            {/* V4 user-report §1.B — body prose dropped: "Sign out
                other devices." duplicated the button label per spec
                §10.4 eliminate redundancy. The h2 + session row +
                primary destructive button are self-describing. */}
            {sessions.length > 0 ? (
              <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    // V2 §5.10 aria-current on current session.
                    aria-current={s.current ? "true" : undefined}
                    className="group flex flex-wrap items-center gap-x-2 gap-y-1 py-3"
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: s.current
                          ? "var(--success-ink)"
                          : "var(--text-tertiary)",
                      }}
                    />
                    <span className="ui-caps-3 text-[var(--success-ink)]">
                      {s.current
                        ? SETTINGS_SECURITY_STRINGS.sessionsCurrentLabel
                        : "DEVICE"}
                    </span>
                    {/* V4 §2.3 — hairline pipe instead of middle-dot
                        between caps token + expiry chip. */}
                    {s.expiresAt ? (
                      <>
                        <span
                          aria-hidden
                          className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
                        />
                        {/* V4 §1.2 — surface session expiry as caps chip;
                            <time> carries dateTime + UTC title attrs. */}
                        <time
                          className="ui-caps-3 text-[var(--text-tertiary)]"
                          {...timeAttrs(s.expiresAt)}
                        >
                          EXPIRES {fmtRelative(s.expiresAt)}
                        </time>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {/* V4 user-report §1.C — restructure action cluster.
                Three affordances with mixed visual weight (button +
                two links) were wrapping unpredictably, orphaning
                "Sign out this device" on its own row. Fix: primary
                destructive action (button) gets its own row; the
                two text-link affordances share a secondary row
                separated by a hairline pipe. No orphans regardless
                of card width. */}
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                className="ui-btn-secondary inline-flex max-w-max items-center gap-1 rounded-full border-[color:color-mix(in_oklab,var(--danger-ink)_28%,var(--border-subtle))] px-4 py-2 text-sm text-[var(--danger-ink)] billing-no-print"
                disabled={pending}
                onClick={() => setSignOutConfirmOpen(true)}
              >
                Sign out other devices
              </button>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {/* V2 §1.47 sign out current device. Placed before
                    Change password since both are sign-out related;
                    Change password is the maintenance affordance. */}
                <Link
                  href="/auth/sign-out"
                  className="ui-link text-[12.5px]"
                >
                  {SETTINGS_SECURITY_STRINGS.signOutSelfCta}
                </Link>
                <span
                  aria-hidden
                  className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
                />
                <Link
                  href="/settings/account?action=change-password"
                  className="ui-link text-[12.5px]"
                >
                  {SETTINGS_SECURITY_STRINGS.passwordChangeCta}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* === Workspace MFA policy === */}
        {/* V2 §1.11 — workspace section-divider DROPPED. The card's
            own eyebrow + the right-rail label are sufficient. */}
        {isAdmin ? (
          <section
            id="org-mfa-card"
            aria-busy={pending && orgMfaConfirmOpen === false}
            // V2 §2.27 conditional REQUIRED border.
            className={`ui-card p-0 ${orgMfa ? "border-[color:color-mix(in_oklab,var(--success-ink)_18%,var(--border-subtle))]" : ""}`}
          >
            {/* V4 user-report §4 — header uses items-start + gap-3
                + no flex-wrap. The title block carries min-w-0 so
                a long h2 ("MFA enforcement") rendered well rather
                than forcing the AT RISK badge to wrap to a second
                row. Badge keeps `shrink-0` to anchor right. */}
            <header className="flex items-start justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
              <div className="flex min-w-0 items-start gap-3">
                <CardMedallion>
                  <Building2 className="h-4 w-4" strokeWidth={1.85} />
                </CardMedallion>
                <div className="min-w-0">
                  <p className="ui-caps-1 text-[var(--accent)]">
                    <span className="">
                      {SETTINGS_SECURITY_STRINGS.eyebrows.policy}
                    </span>
                  </p>
                  <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight leading-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                    {SETTINGS_SECURITY_STRINGS.sections.workspaceMfa}
                  </h2>
                </div>
              </div>
              {/* V4 §1.8 — tone-coded escalation. When orgMfa is
                  OFF and the user has no factors, surface AT RISK
                  warning tone instead of empty/grey OPTIONAL.
                  V4 user-report §4 — badge wrapped in shrink-0
                  span so it anchors top-right.
                  V4 user-report §5 — at-risk variant was 17 chars
                  ("workspace exposed") which forced the h2 to wrap.
                  Shortened to "AT RISK" (7 chars) to match the
                  width-class of REQUIRED (8) / OPTIONAL (8); h2
                  now fits on a single line at 2-col grid widths.
                  "Workspace" context is implicit (this is the
                  workspace policy card). */}
              <span className="shrink-0">
                {orgMfa ? (
                  <StatusBadge status="healthy">REQUIRED</StatusBadge>
                ) : factorsEmpty ? (
                  <StatusBadge status="warning">AT RISK</StatusBadge>
                ) : (
                  <StatusBadge status="empty">OPTIONAL</StatusBadge>
                )}
              </span>
            </header>
            <div className="px-5 py-5">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 billing-no-print">
                <UiToggle
                  name="org-mfa"
                  label="Require MFA for all members"
                  description={SETTINGS_SECURITY_STRINGS.orgMfaConsequence}
                  checked={orgMfa}
                  disabled={pending}
                  ariaLabel="Require MFA for all members"
                  onChange={(checked) => {
                    if (checked && !orgMfa) {
                      setPendingOrgMfaValue(true);
                      setOrgMfaConfirmOpen(true);
                    } else {
                      startTransition(async () => {
                        setError(null);
                        setMessage(null);
                        const r = await updateOrganizationMfaRequired({
                          organizationId: orgId,
                          required: checked,
                        });
                        if (handleActionResult(r, "Workspace MFA policy updated.")) {
                          setOrgMfa(checked);
                        }
                      });
                    }
                  }}
                />
              </div>
              {/* V4 §6.2 — "What changes for members?" disclosure.
                  Resolves §1.4 height asymmetry beneath the toggle. */}
              <details className="group mt-3">
                <summary className="ui-caps-3 inline-flex cursor-pointer items-center gap-1.5 text-[var(--text-tertiary)] marker:hidden [&::-webkit-details-marker]:hidden">
                  {SETTINGS_SECURITY_STRINGS.policyExplainerSummary}
                  <ChevronRight
                    className="h-3 w-3 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  {SETTINGS_SECURITY_STRINGS.policyExplainerBody}
                </p>
              </details>
            </div>
            {/* keep id for ariaLabel association */}
            <span hidden id={orgMfaToggleId} />
          </section>
        ) : orgMfaRequired ? (
          <section className="ui-card p-0">
            <header className="flex items-start gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
              <CardMedallion>
                <Building2 className="h-4 w-4" strokeWidth={1.85} />
              </CardMedallion>
              <div>
                <p className="ui-caps-1 text-[var(--accent)]">
                  <span className="">
                    {SETTINGS_SECURITY_STRINGS.eyebrows.policy}
                  </span>
                </p>
                <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                  {SETTINGS_SECURITY_STRINGS.sections.workspaceMfa}
                </h2>
              </div>
            </header>
            <div className="px-5 py-5">
              <p className="text-[13.5px] text-[var(--text-secondary)]">
                {SETTINGS_SECURITY_STRINGS.workspaceMfaRequiredReadOnly}
              </p>
            </div>
          </section>
        ) : (
          // Render an empty filler card so the 2-col grid keeps rhythm
          // when non-admin + no policy. Skipping leaves an orphan.
          <div className="hidden lg:block" aria-hidden />
        )}
      </div>

      {/* === Confirmation dialogs === */}
      <UiConfirmDialog
        open={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        title="Sign out other devices?"
        description="Sessions on other devices will be ended immediately."
        destructive
        confirmLabel="Sign out"
        onConfirm={async () => {
          setSignOutConfirmOpen(false);
          await new Promise<void>((resolve) => {
            startTransition(async () => {
              setError(null);
              const r = await revokeOtherSessions();
              handleActionResult(r as MfaActionResult, "Other sessions signed out.");
              resolve();
            });
          });
        }}
      />

      <UiConfirmDialog
        open={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        title="Remove this authenticator?"
        description="You can re-enroll at any time."
        destructive
        confirmLabel="Remove"
        onConfirm={async () => {
          const target = removeConfirm;
          setRemoveConfirm(null);
          if (!target) return;
          await new Promise<void>((resolve) => {
            startTransition(async () => {
              setError(null);
              setPendingFactorId(target.id);
              const r = await unenrollTotpFactor(target.id);
              if (handleActionResult(r, "Authenticator removed.")) {
                setFactors((prev) => prev.filter((x) => x.id !== target.id));
              }
              setPendingFactorId(null);
              resolve();
            });
          });
        }}
      />

      <UiConfirmDialog
        open={orgMfaConfirmOpen}
        onClose={() => setOrgMfaConfirmOpen(false)}
        title="Require MFA for all workspace members?"
        description={SETTINGS_SECURITY_STRINGS.orgMfaConsequence}
        confirmLabel="Require MFA"
        onConfirm={async () => {
          setOrgMfaConfirmOpen(false);
          await new Promise<void>((resolve) => {
            startTransition(async () => {
              setError(null);
              const r = await updateOrganizationMfaRequired({
                organizationId: orgId,
                required: pendingOrgMfaValue,
              });
              if (handleActionResult(r, "Workspace MFA policy updated.")) {
                setOrgMfa(pendingOrgMfaValue);
              }
              resolve();
            });
          });
        }}
      />

      {/* Current AAL for SR users — hidden visually. */}
      <span className="sr-only">
        Current authenticator assurance level: {currentAal ?? "unknown"}.
      </span>
    </div>
  );
}
