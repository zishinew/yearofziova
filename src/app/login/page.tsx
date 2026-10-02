import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { accountsConfigured, createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/account");
  }
  const params = await searchParams;
  return <AccountShell><AuthForm configured={accountsConfigured()} confirmationError={params.error === "confirmation"} /></AccountShell>;
}
