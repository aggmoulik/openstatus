import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { AuthLayout } from "@/components/layout/auth-layout";
import { auth } from "@/lib/auth";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect("/");

  return <AuthLayout>{children}</AuthLayout>;
}
