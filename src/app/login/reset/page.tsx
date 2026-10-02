import { AuthDialog } from "@/components/auth-dialog";
import { SiteCanvas } from "@/components/site-canvas";
import { AuthForm } from "@/components/auth-form";
import { accountsConfigured } from "@/lib/supabase/server";

export default function ResetPage() {
  return <><SiteCanvas skipLoader /><AuthDialog><AuthForm configured={accountsConfigured()} mode="reset" /></AuthDialog></>;
}
