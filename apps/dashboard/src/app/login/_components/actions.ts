"use server";

import { auth } from "@/lib/auth";

export async function signInWithResendAction(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    // TODO: magic link sign-in requires the magic-link plugin for better-auth
    // For now, this is only used in self-hosted/dev mode
    await auth.api.signInEmail({
      body: { email, callbackURL: "/" },
    });
  } catch (e) {
    console.error(e);
  }
}
