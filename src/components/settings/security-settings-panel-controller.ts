import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  startTotpEnrollment,
  unenrollTotpFactor,
  updateOrganizationMfaRequired,
  verifyTotpEnrollment,
  type MfaActionError,
  type MfaActionResult,
} from "@/actions/mfa";
import { revokeOtherSessions } from "@/actions/sessions";
import { mutateJson } from "@/lib/http/client-json";
import { secureRandomId } from "@/lib/security/random";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { ADD_AUTH_BTN_ID } from "./security-settings-panel-constants";
import type {
  EnrollState,
  RemoveConfirmState,
  SecuritySettingsPanelProps,
} from "./security-settings-panel-types";

function isError(r: MfaActionResult): r is MfaActionError {
  return r != null && typeof r === "object" && "error" in r;
}

export function useSecuritySettingsPanelController({
  orgId,
  role,
  orgMfaRequired,
  totpFactors: initialFactors,
  currentAal,
  stepUp,
  sessions,
  mfaAvailable = true,
}: SecuritySettingsPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsStepUpPrompt, setNeedsStepUpPrompt] = useState(false);
  const [factors, setFactors] = useState(initialFactors);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [orgMfa, setOrgMfa] = useState(orgMfaRequired);
  const [orgMfaConfirmOpen, setOrgMfaConfirmOpen] = useState(false);
  const [pendingOrgMfaValue, setPendingOrgMfaValue] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmState>(null);
  const [stepUpPending, setStepUpPending] = useState(false);
  const [optimisticStepUpActive, setOptimisticStepUpActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [idempotencyKey] = useState(() => secureRandomId());
  const enrollHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const stepUpFocusTimerRef = useRef<number | null>(null);
  const copiedSecretTimerRef = useRef<number | null>(null);
  const restoreFocusTimerRef = useRef<number | null>(null);
  const stepUpHelpId = useId();
  const totpHintId = useId();
  const totpErrorId = useId();
  const orgMfaToggleId = useId();
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
  const cannotEnableOrgMfa = factorsEmpty && !orgMfa;
  const stepUpActive = optimisticStepUpActive || stepUp.active;
  const stepUpTone: "healthy" | "warning" | "empty" = stepUpActive ? "healthy" : "empty";
  const stepUpLabel =
    stepUpActive && stepUp.via === "aal2"
      ? SETTINGS_SECURITY_STRINGS.stepUpMfaSessionLabel
      : stepUpActive
        ? SETTINGS_SECURITY_STRINGS.stepUpActiveLabel
        : SETTINGS_SECURITY_STRINGS.stepUpEmptyLabel;

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
        setError(`${r.error} ${SETTINGS_SECURITY_STRINGS.enrollMaxFactorsHint}`);
      }
      if (r.needStepUp) {
        setNeedsStepUpPrompt(true);
        document.getElementById("step-up-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
        const pwInput = document.getElementById("stepup-pass") as HTMLInputElement | null;
        if (stepUpFocusTimerRef.current != null) window.clearTimeout(stepUpFocusTimerRef.current);
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

  async function onStepUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setStepUpPending(true);
    try {
      const result = await mutateJson<{ error?: string; retryAfterMs?: number }>("/api/settings/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": idempotencyKey },
        body: JSON.stringify({ password }),
      });
      if (!result.ok) {
        const isRateLimit =
          typeof result.message === "string" &&
          (result.message.toLowerCase().includes("rate") || result.message.toLowerCase().includes("too many"));
        setError(isRateLimit ? SETTINGS_SECURITY_STRINGS.rateLimitedCopy : result.message || "Could not verify password");
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
      if (copiedSecretTimerRef.current != null) window.clearTimeout(copiedSecretTimerRef.current);
      copiedSecretTimerRef.current = window.setTimeout(() => {
        setCopiedSecret(false);
        copiedSecretTimerRef.current = null;
      }, 2000);
    } catch {
      setCopyFallback(true);
    }
  }

  function startEnrollment() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const r = await startTotpEnrollment();
      if ("error" in r) {
        const errMsg = typeof r.error === "string" ? r.error : "Request failed";
        setError(/max.*factor/i.test(errMsg) ? `${errMsg} ${SETTINGS_SECURITY_STRINGS.enrollMaxFactorsHint}` : errMsg);
        return;
      }
      setEnroll({ factorId: r.factorId, qrCode: r.qrCode, secret: r.secret });
    });
  }

  function verifyEnrollment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enroll) return;
    startTransition(async () => {
      setError(null);
      setVerifyError(null);
      const r = await verifyTotpEnrollment({ factorId: enroll.factorId, code });
      if ("error" in r) {
        setVerifyError(r.error ?? "Request failed");
        return;
      }
      setFactors((prev) => [
        ...prev,
        { id: enroll.factorId, status: "verified", friendly_name: "Authenticator app" },
      ]);
      setEnroll(null);
      setCode("");
      router.push("/settings/security?mfa=enrolled");
    });
  }

  function cancelEnrollment() {
    setEnroll(null);
    setVerifyError(null);
    if (restoreFocusTimerRef.current != null) window.clearTimeout(restoreFocusTimerRef.current);
    restoreFocusTimerRef.current = window.setTimeout(() => {
      const btn = document.getElementById(ADD_AUTH_BTN_ID) as HTMLButtonElement | null;
      btn?.focus();
      restoreFocusTimerRef.current = null;
    }, 50);
  }

  function handleOrgMfaChange(checked: boolean) {
    if (checked && !orgMfa) {
      setPendingOrgMfaValue(true);
      setOrgMfaConfirmOpen(true);
      return;
    }
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const r = await updateOrganizationMfaRequired({ organizationId: orgId, required: checked });
      if (handleActionResult(r, "Workspace MFA policy updated.")) setOrgMfa(checked);
    });
  }

  async function confirmSignOut() {
    setSignOutConfirmOpen(false);
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        setError(null);
        const r = await revokeOtherSessions();
        handleActionResult(r as MfaActionResult, "Other sessions signed out.");
        resolve();
      });
    });
  }

  async function confirmRemove() {
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
  }

  async function confirmOrgMfa() {
    setOrgMfaConfirmOpen(false);
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        setError(null);
        const r = await updateOrganizationMfaRequired({ organizationId: orgId, required: pendingOrgMfaValue });
        if (handleActionResult(r, "Workspace MFA policy updated.")) setOrgMfa(pendingOrgMfaValue);
        resolve();
      });
    });
  }

  const liveMsg =
    pending && removeConfirm
      ? "Removing authenticator..."
      : pending && enroll
        ? "Verifying authenticator..."
        : pending
          ? "Updating security setting..."
          : stepUpPending
            ? "Verifying password..."
            : error ?? message ?? undefined;

  return {
    currentAal,
    isOnline,
    liveMsg,
    error,
    accountProtectionProps: {
      factors,
      factorsEmpty,
      showDangerEmptyState,
      mfaAvailable,
      error,
      message,
      pending,
      pendingFactorId,
      enroll,
      qrSrc,
      code,
      verifyError,
      copiedSecret,
      copyFallback,
      enrollHeadingRef,
      totpHintId,
      totpErrorId,
      onStartEnrollment: startEnrollment,
      onVerifyEnrollment: verifyEnrollment,
      onCodeChange: setCode,
      onCopyManualKey: copyManualKey,
      onCancelEnrollment: cancelEnrollment,
      onRequestRemoveFactor: (id: string, idx: number) => setRemoveConfirm({ id, idx }),
      stepUpPending,
      stepUpVia: stepUp.via,
      optimisticStepUpActive,
      needsStepUpPrompt,
      stepUpLabel,
      stepUpTone,
      password,
      stepUpHelpId,
      idempotencyKey,
      onPasswordChange: setPassword,
      onStepUp,
    },
    sessionsProps: {
      sessions,
      pending,
      onSignOutOthers: () => setSignOutConfirmOpen(true),
    },
    workspaceMfaProps: {
      isAdmin,
      orgMfaRequired,
      orgMfa,
      pending,
      orgMfaConfirmOpen,
      cannotEnableOrgMfa,
      orgMfaHintId,
      orgMfaToggleId,
      onOrgMfaChange: handleOrgMfaChange,
    },
    dialogsProps: {
      signOutConfirmOpen,
      removeConfirm,
      orgMfaConfirmOpen,
      onCloseSignOut: () => setSignOutConfirmOpen(false),
      onCloseRemove: () => setRemoveConfirm(null),
      onCloseOrgMfa: () => setOrgMfaConfirmOpen(false),
      onConfirmSignOut: confirmSignOut,
      onConfirmRemove: confirmRemove,
      onConfirmOrgMfa: confirmOrgMfa,
    },
    stepUpActive,
  };
}
