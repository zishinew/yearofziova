import "server-only";
import { createServerSupabaseClient } from "./server";

export async function getAdminSession() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email_confirmed_at) return null;
  const { data: membership } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return membership ? { supabase, user } : null;
}
