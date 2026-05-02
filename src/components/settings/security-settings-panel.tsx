"use client";

import { useMemo, useState, useTransition } from "react";
import {
  startTotpEnrollment,
  unenrollTotpFactor,
  updateOrganizationMfaRequired,
  verifyTotpEnrollment,
} from "@/actions/mfa";
import { revokeOtherSessions } from "@/actions/sessions";

export type TotpFactorRow = {
  id: string;
  status: string;
  friendly_name: string | null;
};

type Props = {
  orgId: string;
  role: string;
  orgMfaRequired: boolean;
  totpFactors: TotpFactorRow[];
  currentAal: string | null;
  nextAal: string | null;
};

export function SecuritySettingsPanel({
  orgId,
  role,
  orgMfaRequired,
  totpFactors: initialFactors,
  currentAal,
  nextAal,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [factors, setFactors] = useState(initialFactors);
  const [enroll, setEnroll] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [orgMfa, setOrgMfa] = useState(orgMfaRequired);
  const [pending, startTransition] = useTransition();

  const qrSrc = useMemo(() => {
    if (!enroll?.qrCode) return null;
    return enroll.qrCode.startsWith("data:")
      ? enroll.qrCode
      : `data:image/svg+xml;utf-8,${encodeURIComponent(enroll.qrCode)}`;
  }, [enroll]);

  const isAdmin = role === "admin";

  async function onStepUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/step-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Could not verify password");
      return;
    }
    setPassword("");
    setMessage("Step-up confirmed for ~10 minutes. You can create or revoke API keys and start integration OAuth.");
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_92%,transparent)] p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Authenticator (TOTP)</h2>
        <p className="ui-support-copy mt-2 text-sm">
          Current assurance: <span className="font-mono">{currentAal ?? "unknown"}</span>
          {nextAal ? (
            <>
              {" "}
              → next: <span className="font-mono">{nextAal}</span>
            </>
          ) : null}
        </p>
        {error ? (
          <div className="ui-alert-error mt-3 text-sm" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="ui-alert-success mt-3 text-sm" role="status">
            {message}
          </div>
        ) : null}

        <ul className="mt-4 space-y-2 text-sm">
          {factors.length === 0 ? <li className="text-[var(--text-tertiary)]">No TOTP factors enrolled.</li> : null}
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--canvas)] px-3 py-2"
            >
              <span>
                <span className="font-mono text-xs">{f.id.slice(0, 8)}…</span>{" "}
                <span className="text-[var(--text-secondary)]">({f.status})</span>
              </span>
              <button
                type="button"
                className="ui-btn-secondary px-3 py-1 text-xs"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const r = await unenrollTotpFactor(f.id);
                    if ("error" in r) {
                      setError(typeof r.error === "string" ? r.error : "Request failed");
                      return;
                    }
                    setFactors((prev) => prev.filter((x) => x.id !== f.id));
                    setMessage("Authenticator removed.");
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {!enroll ? (
          <button
            type="button"
            className="ui-btn-secondary mt-4 px-4 py-2 text-sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await startTotpEnrollment();
                if ("error" in r) {
                  setError(typeof r.error === "string" ? r.error : "Request failed");
                  return;
                }
                setEnroll({ factorId: r.factorId, qrCode: r.qrCode, secret: r.secret });
              })
            }
          >
            Add authenticator
          </button>
        ) : (
          <div className="mt-4 space-y-4">
            {qrSrc ? (
              <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white p-2">
                {/* MFA enroll returns inline SVG/data — next/image remotePatterns cannot represent dynamic data: URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="TOTP QR code" className="h-48 w-48 object-contain" />
              </div>
            ) : null}
            <p className="text-xs text-[var(--text-tertiary)]">
              Manual secret (treat like a password):{" "}
              <span className="font-mono break-all text-[var(--text-secondary)]">{enroll.secret}</span>
            </p>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  setError(null);
                  const r = await verifyTotpEnrollment({ factorId: enroll.factorId, code });
                  if ("error" in r) {
                    setError(typeof r.error === "string" ? r.error : "Request failed");
                    return;
                  }
                  setFactors((prev) => [...prev, { id: enroll.factorId, status: "verified", friendly_name: null }]);
                  setEnroll(null);
                  setCode("");
                  setMessage("Authenticator verified.");
                });
              }}
            >
              <div className="min-w-0 flex-1">
                <label htmlFor="totp-code" className="ui-label">
                  Verification code
                </label>
                <input
                  id="totp-code"
                  className="ui-input mt-1 w-full"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(ev) => setCode(ev.target.value)}
                />
              </div>
              <button type="submit" className="ui-btn-primary px-4 py-2 text-sm" disabled={pending}>
                Confirm
              </button>
            </form>
            <button
              type="button"
              className="text-xs text-[var(--text-tertiary)] underline"
              onClick={() => setEnroll(null)}
            >
              Cancel enrollment
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_92%,transparent)] p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Sessions</h2>
        <p className="ui-support-copy mt-2 text-sm">
          Detailed per-device listings require Supabase dashboard access; you can revoke other active sessions for this
          account.
        </p>
        <button
          type="button"
          className="ui-btn-secondary mt-4 px-4 py-2 text-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await revokeOtherSessions();
              if ("error" in r) {
                setError(typeof r.error === "string" ? r.error : "Request failed");
                return;
              }
              setMessage("Other sessions signed out.");
            })
          }
        >
          Sign out other sessions
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_92%,transparent)] p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Step-up (password)</h2>
        <p className="ui-support-copy mt-2 text-sm">
          Required before creating or revoking integration API keys and before starting calendar/integration OAuth from
          the API.
        </p>
        <form onSubmit={onStepUp} className="mt-4 flex max-w-md flex-col gap-3">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="ui-btn-primary w-fit px-4 py-2 text-sm" disabled={pending}>
            Confirm step-up
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_92%,transparent)] p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Data export</h2>
        <p className="ui-support-copy mt-2 text-sm">
          Download a JSON summary of your profile and primary organization (DSR-oriented). Disable globally with{" "}
          <code className="rounded bg-[var(--surface-muted)] px-1">OBLIXA_DSR_SELF_EXPORT=0</code>.
        </p>
        <a
          href="/api/me/export"
          className="ui-btn-secondary mt-4 inline-flex px-4 py-2 text-sm"
          download
        >
          Download self-export
        </a>
      </section>

      {isAdmin ? (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_92%,transparent)] p-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Organization MFA policy</h2>
          <p className="ui-support-copy mt-2 text-sm">
            When enabled, members must complete MFA (AAL2) before using workspace routes outside this page.
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={orgMfa}
              disabled={pending}
              onChange={(e) => {
                const checked = e.target.checked;
                startTransition(async () => {
                  setError(null);
                  const r = await updateOrganizationMfaRequired({ organizationId: orgId, required: checked });
                  if ("error" in r) {
                    setError(typeof r.error === "string" ? r.error : "Request failed");
                    return;
                  }
                  setOrgMfa(checked);
                  setMessage("Organization MFA policy updated.");
                });
              }}
            />
            <span>Require MFA for all members</span>
          </label>
        </section>
      ) : null}
    </div>
  );
}
