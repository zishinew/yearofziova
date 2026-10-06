"use server";

import { paymentServices } from "@/lib/stripe";
import { ownsOrder } from "@/lib/guest-checkout";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function downloadPurchase(purchaseId: string): Promise<{ url?: string; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseId)) {
    return { error: "This download is unavailable." };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Downloads are not available yet." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const { db } = paymentServices();
  const { data, error } = await db.from("purchases")
    .select("checkout_orders(id,user_id,guest_token_hash),download_products!inner(storage_path, download_name),user_id")
    .eq("id", purchaseId).eq("status", "paid").single();
  if (error || !data) return { error: "This download is unavailable." };
  const order = Array.isArray(data.checkout_orders) ? data.checkout_orders[0] : data.checkout_orders;
  const userId = !authError && user?.email_confirmed_at ? user.id : undefined;
  if (!(userId && data.user_id === userId) && !(order && await ownsOrder(order, userId))) return { error: "This download is unavailable." };
  const product = Array.isArray(data.download_products) ? data.download_products[0] : data.download_products;
  if (!product?.storage_path) return { error: "This download is unavailable." };
  const { data: signed, error: storageError } = await db.storage.from("purchased-beats")
    .createSignedUrl(product.storage_path, 60, { download: product.download_name });
  if (storageError || !signed) return { error: "Couldn't prepare your download. Please try again." };
  return { url: signed.signedUrl };
}
