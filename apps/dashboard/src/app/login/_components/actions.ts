"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function signInWithResendAction(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    await auth.api.signInMagicLink({
      headers: await headers(),
      body: { email, callbackURL: "/" },
    });
  } catch (e) {
    console.error(e);
  }
}
