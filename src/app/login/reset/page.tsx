import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { accountsConfigured } from "@/lib/supabase/server";

export default function ResetPage() {
  return <AccountShell><AuthForm configured={accountsConfigured()} mode="reset" /></AccountShell>;
}
