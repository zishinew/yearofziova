import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login/reset");
  return <AccountShell><AuthForm configured mode="password" /></AccountShell>;
}
