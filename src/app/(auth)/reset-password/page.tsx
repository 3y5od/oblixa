import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string; error_description?: string }>;
}) {
  const q = await searchParams;
  // Supabase appends error/error_code to the recovery redirect when the link is
  // invalid or expired (mirrors how /login reads its error param).
  const linkInvalid = Boolean(q.error || q.error_code);

  return <AuthForm mode="reset-password" linkInvalid={linkInvalid} />;
}
