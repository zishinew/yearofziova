"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function downloadPurchase(purchaseId: string): Promise<{ url?: string; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseId)) {
    return { error: "This download is unavailable." };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Downloads are not available yet." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email_confirmed_at) return { error: "Please sign in with a confirmed email to download your beats." };
  const { data, error } = await supabase.from("purchases")
    .select("download_products!inner(storage_path, download_name)")
    .eq("id", purchaseId).eq("user_id", user.id).eq("status", "paid").single();
  if (error || !data) return { error: "This download is unavailable." };
  const product = Array.isArray(data.download_products) ? data.download_products[0] : data.download_products;
  if (!product?.storage_path) return { error: "This download is unavailable." };
  const { data: signed, error: storageError } = await supabase.storage.from("purchased-beats")
    .createSignedUrl(product.storage_path, 60, { download: product.download_name });
  if (storageError || !signed) return { error: "Couldn't prepare your download. Please try again." };
  return { url: signed.signedUrl };
}
