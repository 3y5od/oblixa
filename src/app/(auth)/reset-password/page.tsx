import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return <AuthForm mode="reset-password" />;
}
