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
  Lock,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
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
import { SettingsCardHeader } from "@/components/settings/settings-card";
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

const COLUMN_HEADING_CLASS =
  "flex items-center gap-2 text-[13px] font-semibold tracking-tight text-[var(--text-primary)]";

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
  const [optimisticStepUpActive, setOptimisticStepUpActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  // Stable idempotency key so a noscript refresh-replay submits the same key.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const enrollHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const stepUpFocusTimerRef = useRef<number | null>(null);
  const copiedSecretTimerRef = useRef<number | null>(null);
  const restoreFocusTimerRef = useRef<number | null>(null);
  // AsyncActionButton doesn't forward refs, so focus restoration looks the
  // trigger up by id.
  const ADD_AUTH_BTN_ID = "mfa-add-authenticator-btn";
  const stepUpHelpId = useId();
  const totpHintId = useId();
  const totpErrorId = useId();
  const orgMfaToggleId = useId();
  // Ties the self-lockout hint to the disabled org-MFA toggle for SR users.
  const orgMfaHintId = useId();
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
  const showDangerEmptyState = factorsEmpty && orgMfaRequired;

  // Self-lockout guard: block enabling workspace-wide MFA while this admin
  // has no authenticator of their own. Only the enable path is blocked.
  const cannotEnableOrgMfa = factorsEmpty && !orgMfa;

  // Optimistic step-up may be stale across tabs; the server-side
  // hasSensitiveActionProof is the source of truth on the next mutation.
  const stepUpActive = optimisticStepUpActive || stepUp.active;

  // Step-up badge label + tone vary by via. Each badge carries a leading
  // glyph so the state is legible without relying on color alone.
  let stepUpLabel: string;
  let stepUpTone: "healthy" | "warning" | "empty";
  let stepUpIcon: React.ReactNode;
  if (stepUpActive && stepUp.via === "aal2") {
    stepUpLabel = SETTINGS_SECURITY_STRINGS.stepUpMfaSessionLabel;
    stepUpTone = "healthy";
    stepUpIcon = <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />;
  } else if (stepUpActive) {
    stepUpLabel = SETTINGS_SECURITY_STRINGS.stepUpActiveLabel;
    stepUpTone = "healthy";
    stepUpIcon = <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />;
  } else {
    stepUpLabel = SETTINGS_SECURITY_STRINGS.stepUpEmptyLabel;
    stepUpTone = "empty";
    stepUpIcon = <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />;
  }

  useEffect(() => {
    if (enroll && enrollHeadingRef.current) {
      enrollHeadingRef.current.focus();
    }
  }, [enroll]);

  useEffect(() => {
    return () => {
      for (const timer of [
        stepUpFocusTimerRef.current,
        copiedSecretTimerRef.current,
        restoreFocusTimerRef.current,
      ]) {
        if (timer != null) window.clearTimeout(timer);
      }
    };
  }, []);

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

  // Announce factor-count transitions to screen readers.
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
        if (stepUpFocusTimerRef.current != null) {
          window.clearTimeout(stepUpFocusTimerRef.current);
        }
        stepUpFocusTimerRef.current = window.setTimeout(() => {
          pwInput?.focus();
          stepUpFocusTimerRef.current = null;
        }, 350);
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
      setOptimisticStepUpActive(true);
      setMessage("Password confirmed. Sensitive actions are unlocked for about 10 minutes.");
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
      if (copiedSecretTimerRef.current != null) {
        window.clearTimeout(copiedSecretTimerRef.current);
      }
      copiedSecretTimerRef.current = window.setTimeout(() => {
        setCopiedSecret(false);
        copiedSecretTimerRef.current = null;
      }, 2000);
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

  const showEnrolledCount = factorCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <LiveRegion message={liveMsg} politeness={error ? "assertive" : "polite"} />

      {!isOnline ? (
        <UiAlert tone="warning">
          {SETTINGS_SECURITY_STRINGS.offlineCopy}
        </UiAlert>
      ) : null}

      {/* Focal "Account protection" card — Authenticator + Sensitive actions
          read as one surface in a two-column body, not two competing cards. */}
      <section
        id="account-protection-card"
        className="ui-card-raised p-0"
        aria-busy={pending && (enroll != null || pendingFactorId != null)}
      >
        <SettingsCardHeader
          icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.85} />}
          eyebrow={SETTINGS_SECURITY_STRINGS.eyebrows.protection}
          title={SETTINGS_SECURITY_STRINGS.sections.protection}
          badge={
            showEnrolledCount ? (
              <KeyValueChip label="ENROLLED" value={factorCount} tone="success" />
            ) : null
          }
        />

        <div className="grid divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {/* === Authenticator column === */}
          <div
            id="mfa-card"
            aria-busy={pending && (enroll != null || pendingFactorId != null)}
            className="min-w-0 px-5 py-5"
          >
            <h3 className={COLUMN_HEADING_CLASS}>
              <Smartphone
                className="h-4 w-4 text-[var(--accent-strong)]"
                strokeWidth={1.85}
                aria-hidden
              />
              {SETTINGS_SECURITY_STRINGS.sections.mfaColumn}
            </h3>

            <InlineMutationStatus
              message={error ?? message}
              variant={error ? "error" : "success"}
              className="mb-3 mt-3 text-sm"
            />

            {factorsEmpty ? (
              <div
                className="mt-3 flex flex-col gap-2 rounded-lg border px-3 py-3"
                style={{
                  borderColor: showDangerEmptyState
                    ? "color-mix(in oklab, var(--danger-ink) 28%, var(--border-subtle))"
                    : "color-mix(in oklab, var(--warning-soft) 55%, var(--border-subtle))",
                  background: showDangerEmptyState
                    ? "color-mix(in oklab, var(--danger-soft) 18%, var(--surface-raised))"
                    : "color-mix(in oklab, var(--warning-soft) 18%, var(--surface-raised))",
                }}
              >
                <StatusBadge
                  status={showDangerEmptyState ? "critical" : "warning"}
                  className="gap-1 self-start"
                >
                  <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
                  {SETTINGS_SECURITY_STRINGS.mfaEmptyLabel}
                </StatusBadge>
                <p
                  className="text-[12.5px] leading-snug"
                  style={{
                    color: showDangerEmptyState
                      ? "var(--danger-ink)"
                      : "var(--text-secondary)",
                  }}
                >
                  {showDangerEmptyState
                    ? SETTINGS_SECURITY_STRINGS.mfaEmptyBodyRequired
                    : SETTINGS_SECURITY_STRINGS.mfaEmptyBody}
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
                {factors.map((f, idx) => (
                  <li
                    key={f.id}
                    aria-busy={pendingFactorId === f.id}
                    className="group flex flex-wrap items-center gap-3 py-3"
                  >
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
                <h4
                  ref={enrollHeadingRef}
                  tabIndex={-1}
                  className="ui-caps-2 text-[var(--text-tertiary)] outline-none"
                >
                  ENROLL AUTHENTICATOR
                </h4>
                {qrSrc ? (
                  <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2">
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
                    if (restoreFocusTimerRef.current != null) {
                      window.clearTimeout(restoreFocusTimerRef.current);
                    }
                    restoreFocusTimerRef.current = window.setTimeout(() => {
                      const btn = document.getElementById(
                        ADD_AUTH_BTN_ID
                      ) as HTMLButtonElement | null;
                      btn?.focus();
                      restoreFocusTimerRef.current = null;
                    }, 50);
                  }}
                >
                  {SETTINGS_SECURITY_STRINGS.enrollmentCancelCta}
                </button>
              </div>
            )}

            {factorsEmpty && !enroll ? (
              <details className="group mt-4">
                <summary className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)] marker:hidden hover:underline [&::-webkit-details-marker]:hidden">
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

          {/* === Sensitive actions column === */}
          <div id="step-up-card" aria-busy={stepUpPending} className="min-w-0 px-5 py-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className={COLUMN_HEADING_CLASS}>
                <KeyRound
                  className="h-4 w-4 text-[var(--accent-strong)]"
                  strokeWidth={1.85}
                  aria-hidden
                />
                {SETTINGS_SECURITY_STRINGS.sections.stepUpColumn}
              </h3>
              <span className="shrink-0">
                <StatusBadge status={stepUpTone} className="gap-1 whitespace-nowrap">
                  {stepUpIcon}
                  {stepUpLabel}
                </StatusBadge>
              </span>
            </div>

            {stepUp.via === "aal2" && !optimisticStepUpActive ? (
              <p className="ui-caps-3 mt-3 text-[var(--success-ink)]">
                {SETTINGS_SECURITY_STRINGS.stepUpAal2Note}
              </p>
            ) : null}

            {needsStepUpPrompt ? (
              <p className="mt-3 text-[12.5px] text-[var(--warning-ink)]">
                {SETTINGS_SECURITY_STRINGS.stepUpRequiredPrompt}
              </p>
            ) : null}

            <noscript>
              <form
                action="/api/settings/step-up"
                method="POST"
                className="mt-3 flex max-w-sm flex-col gap-3"
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
              className="mt-3 flex max-w-sm flex-col gap-3 billing-no-print"
            >
              <div>
                <label htmlFor="stepup-pass" className="ui-label">
                  Account password
                </label>
                <div className="relative mt-1">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                  <input
                    id="stepup-pass"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    className="ui-input w-full pl-9"
                    placeholder={SETTINGS_SECURITY_STRINGS.passwordPlaceholder}
                    aria-describedby={stepUpHelpId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <span id={stepUpHelpId} className="sr-only">
                  {SETTINGS_SECURITY_STRINGS.stepUpFormHelp}
                </span>
              </div>
              <AsyncActionButton
                type="submit"
                className="ui-btn-primary inline-flex w-full items-center gap-1 rounded-full px-4 py-2 text-sm sm:w-auto sm:self-start"
                pending={stepUpPending}
                pendingLabel="Confirming…"
              >
                {SETTINGS_SECURITY_STRINGS.stepUpFormCta}
              </AsyncActionButton>
            </form>

            {/* Account-password maintenance lives with the sensitive-actions
                column, not the device list. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
              <Link
                href="/settings/account?action=change-password"
                className="ui-link text-[12.5px]"
              >
                {SETTINGS_SECURITY_STRINGS.passwordChangeCta}
              </Link>
              <Link
                href="/auth/forgot-password"
                className="ui-link text-[12.5px] text-[var(--text-tertiary)] billing-no-print"
              >
                {SETTINGS_SECURITY_STRINGS.forgotPasswordCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sessions — a compact flat row group, not a tall card. */}
      <section aria-labelledby="sessions-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pb-2">
          <h2
            id="sessions-title"
            className="inline-flex items-baseline gap-2 text-[13px] font-semibold tracking-tight text-[var(--text-primary)]"
          >
            <span className="ui-caps-2 text-[var(--accent-strong)]">
              {SETTINGS_SECURITY_STRINGS.eyebrows.sessions}
            </span>
            <span>{SETTINGS_SECURITY_STRINGS.sections.sessions}</span>
            {sessions.length > 1 ? (
              <span className="ui-caps-3 font-normal tabular-nums text-[var(--text-tertiary)]">
                {sessions.length} DEVICES
              </span>
            ) : null}
          </h2>
        </div>
        {sessions.length > 0 ? (
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
            {sessions.map((s) => (
              <li
                key={s.id}
                aria-current={s.current ? "true" : undefined}
                className="group flex flex-wrap items-center gap-2 py-2.5"
              >
                <StatusBadge status={s.current ? "healthy" : "disabled"}>
                  {s.current
                    ? SETTINGS_SECURITY_STRINGS.sessionsCurrentLabel
                    : "DEVICE"}
                </StatusBadge>
                {s.expiresAt ? (
                  <time
                    className="text-[11.5px] tabular-nums text-[var(--text-tertiary)]"
                    {...timeAttrs(s.expiresAt)}
                  >
                    Expires {fmtRelative(s.expiresAt)}
                    <span className="sr-only">
                      {" "}
                      ({formatDate(s.expiresAt, "dateTime")})
                    </span>
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ui-btn-secondary rounded-full border-[color:color-mix(in_oklab,var(--danger-ink)_28%,var(--border-subtle))] text-[var(--danger-ink)] billing-no-print"
            disabled={pending}
            onClick={() => setSignOutConfirmOpen(true)}
          >
            Sign out other devices
          </button>
          <Link
            href="/auth/sign-out"
            className="ui-btn-ghost rounded-full billing-no-print"
          >
            {SETTINGS_SECURITY_STRINGS.signOutSelfCta}
          </Link>
        </div>
      </section>

      {/* Workspace MFA enforcement — secondary card. */}
      {isAdmin ? (
        <section
          id="org-mfa-card"
          aria-busy={pending && orgMfaConfirmOpen === false}
          className={`ui-card p-0 ${orgMfa ? "border-[color:color-mix(in_oklab,var(--success-ink)_18%,var(--border-subtle))]" : ""}`}
        >
          <SettingsCardHeader
            icon={<Building2 className="h-4 w-4" strokeWidth={1.85} />}
            eyebrow={SETTINGS_SECURITY_STRINGS.eyebrows.policy}
            title={SETTINGS_SECURITY_STRINGS.sections.workspaceMfa}
            badge={
              orgMfa ? (
                <StatusBadge status="healthy" className="gap-1">
                  <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
                  REQUIRED
                </StatusBadge>
              ) : factorsEmpty ? (
                <StatusBadge status="warning" className="gap-1 whitespace-nowrap">
                  <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
                  ENROLL FIRST
                </StatusBadge>
              ) : (
                <StatusBadge status="empty">OPTIONAL</StatusBadge>
              )
            }
          />
          <div className="px-5 py-5">
            <div className="billing-no-print">
              <UiToggle
                name="org-mfa"
                label="Require MFA for all members"
                description={SETTINGS_SECURITY_STRINGS.orgMfaConsequence}
                checked={orgMfa}
                disabled={pending || cannotEnableOrgMfa}
                ariaLabel="Require MFA for all members"
                ariaDescribedBy={cannotEnableOrgMfa ? orgMfaHintId : undefined}
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
              {cannotEnableOrgMfa ? (
                <p id={orgMfaHintId} className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--warning-ink)]">
                  <TriangleAlert
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                  {SETTINGS_SECURITY_STRINGS.orgMfaSelfLockoutHint}
                </p>
              ) : null}
            </div>
            <details className="group mt-3">
              <summary className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)] marker:hidden hover:underline [&::-webkit-details-marker]:hidden">
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
          <span hidden id={orgMfaToggleId} />
        </section>
      ) : orgMfaRequired ? (
        <section className="ui-card p-0">
          <SettingsCardHeader
            icon={<Building2 className="h-4 w-4" strokeWidth={1.85} />}
            eyebrow={SETTINGS_SECURITY_STRINGS.eyebrows.policy}
            title={SETTINGS_SECURITY_STRINGS.sections.workspaceMfa}
          />
          <div className="px-5 py-5">
            <p className="text-[13.5px] text-[var(--text-secondary)]">
              {SETTINGS_SECURITY_STRINGS.workspaceMfaRequiredReadOnly}
            </p>
          </div>
        </section>
      ) : null}

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
