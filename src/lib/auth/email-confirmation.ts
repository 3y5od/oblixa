export type EmailConfirmationSignals = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export function hasEmailConfirmationSignal(user: EmailConfirmationSignals): boolean {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}
