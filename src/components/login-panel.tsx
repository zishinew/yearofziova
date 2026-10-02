import { redirect } from "next/navigation";
import { AuthDialog } from "@/components/auth-dialog";
import { AuthForm } from "@/components/auth-form";
import { SiteCanvas } from "@/components/site-canvas";
import { accountsConfigured, createServerSupabaseClient } from "@/lib/supabase/server";

export async function LoginPanel({ searchParams, intercepted = false }: {
  searchParams: Promise<{ error?: string }>;
  intercepted?: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/account");
  }
  const params = await searchParams;
  return <>
    {!intercepted && <SiteCanvas skipLoader />}
    <AuthDialog intercepted={intercepted}>
      <AuthForm configured={accountsConfigured()} confirmationError={params.error === "confirmation"} />
    </AuthDialog>
  </>;
}
