import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot-password" />;
}
