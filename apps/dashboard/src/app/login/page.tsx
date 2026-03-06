"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { signIn } from "@/lib/auth/client";
import { GitHubIcon, GoogleIcon } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Separator } from "@openstatus/ui/components/ui/separator";
import MagicLinkForm from "./_components/magic-link-form";

export default function Page() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  return (
    <div className="my-4 grid w-full max-w-lg gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-semibold text-3xl tracking-tight">Sign In</h1>
        <p className="text-muted-foreground text-sm">
          Get started now. No credit card required.
        </p>
      </div>
      <div className="grid gap-3 p-4">
        {process.env.NEXT_PUBLIC_SELF_HOST === "true" ? (
          <div className="grid gap-3">
            <MagicLinkForm />
            <Separator />
          </div>
        ) : null}
        <Button
          onClick={() =>
            signIn.social({
              provider: "github",
              callbackURL: redirectTo ?? "/",
            })
          }
          className="w-full"
        >
          Sign in with GitHub <GitHubIcon className="ml-2 h-4 w-4" />
        </Button>
        <Button
          onClick={() =>
            signIn.social({
              provider: "google",
              callbackURL: redirectTo ?? "/",
            })
          }
          className="w-full"
          variant="outline"
        >
          Sign in with Google <GoogleIcon className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <p className="px-8 text-center text-muted-foreground text-sm">
        By clicking continue, you agree to our{" "}
        <Link
          href="https://openstatus.dev/legal/terms"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="https://openstatus.dev/legal/privacy"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
