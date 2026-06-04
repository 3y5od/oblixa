import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Request access to Oblixa",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
