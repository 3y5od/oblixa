import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Sign in to Oblixa",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  let urlBanner: string | undefined;
  if (q.error === "invite_invalid") {
    urlBanner =
      "This invitation is invalid or has expired. Ask your admin for a new invite.";
  } else if (q.error === "invite_email_mismatch") {
    urlBanner = "Sign in with the same email address the invitation was sent to.";
  } else if (q.error === "auth_callback_error") {
    urlBanner = "Sign-in could not be completed. Try again or request a new link.";
  }

  return <AuthForm mode="login" urlBanner={urlBanner} />;
}
