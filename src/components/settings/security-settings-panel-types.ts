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

export type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
} | null;

export type RemoveConfirmState = { id: string; idx: number } | null;

export type StepUpState = {
  active: boolean;
  via: "password" | "aal2" | null;
  expiresAt: number | null;
};

export type SecuritySettingsPanelProps = {
  orgId: string;
  role: string;
  orgMfaRequired: boolean;
  totpFactors: TotpFactorRow[];
  currentAal: string | null;
  nextAal: string | null;
  stepUp: StepUpState;
  sessions: SessionRow[];
  /** False when the auth provider cannot offer authenticator enrollment; the
   *  Authenticator column then shows an unavailable state instead of enroll. */
  mfaAvailable?: boolean;
};
