import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminSession } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    const client = await createServerSupabaseClient();
    const result = client ? await client.auth.getUser() : null;
    redirect(result?.data.user ? "/account" : "/login");
  }
  const { data, error } = await session.supabase.from("catalog_tracks").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  return <AccountShell><AdminDashboard tracks={data || []} loadError={Boolean(error)} /></AccountShell>;
}
