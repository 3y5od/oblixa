import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Start your free trial of Oblixa",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
