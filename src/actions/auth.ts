"use server";

import {
  forgotPassword as forgotPasswordImpl,
  resetPassword as resetPasswordImpl,
  signIn as signInImpl,
  signOut as signOutImpl,
  signUp as signUpImpl,
  type AuthActionResult,
} from "@/lib/auth/auth-action-impl";

export async function signUp(formData: FormData): Promise<AuthActionResult> {
  return signUpImpl(formData);
}

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  return signInImpl(formData);
}

export async function signOut() {
  return signOutImpl();
}

export async function forgotPassword(formData: FormData) {
  return forgotPasswordImpl(formData);
}

export async function resetPassword(formData: FormData) {
  return resetPasswordImpl(formData);
}
