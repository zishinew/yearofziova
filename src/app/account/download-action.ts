"use server";

import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { ownsOrder } from "@/lib/guest-checkout";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { detuningFromText, parseTrackText } from "@/lib/track-upload";

const downloadFields = "storage_path,download_name,lease,catalog_track_id,title,bpm,catalog_tracks!catalog_track_id(title,bpm,musical_key,notes)";

export async function downloadPurchase(purchaseId: string, format?: "mp3" | "wav"): Promise<{ url?: string; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseId)) {
    return { error: "This download is unavailable." };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Downloads are not available yet." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const db = createServiceSupabaseClient();
  const { data, error } = await db.from("purchases")
    .select(`checkout_orders(id,user_id,guest_token_hash),download_products!inner(${downloadFields}),user_id`)
    .eq("id", purchaseId).eq("status", "paid").single();
  if (error || !data) return { error: "This download is unavailable." };
  const order = Array.isArray(data.checkout_orders) ? data.checkout_orders[0] : data.checkout_orders;
  const userId = !authError && user?.email_confirmed_at ? user.id : undefined;
  if (!(userId && data.user_id === userId) && !(order && await ownsOrder(order, userId))) return { error: "This download is unavailable." };
  let product = Array.isArray(data.download_products) ? data.download_products[0] : data.download_products;
  if (format && format !== "mp3" && format !== "wav") return { error: "This download is unavailable." };
  if (format && product && format !== product.lease) {
    if (format !== "mp3" || product.lease !== "wav" || !product.catalog_track_id) return { error: "This format isn't included in your license." };
    const { data: mp3, error: formatError } = await db.from("download_products").select(downloadFields)
      .eq("catalog_track_id",product.catalog_track_id).eq("lease","mp3").single();
    if (formatError || !mp3) return { error: "This format is temporarily unavailable." };
    product = mp3;
  }
  if (!product?.storage_path) return { error: "This download is unavailable." };
  const track = Array.isArray(product.catalog_tracks) ? product.catalog_tracks[0] : product.catalog_tracks;
  const rawTitle = track?.title || product.title;
  const title = parseTrackText(rawTitle).title || "Beat";
  const bpm = track?.bpm ?? product.bpm;
  const detune = detuningFromText(track?.notes?.join("\n") ?? "")
    ?? detuningFromText(rawTitle)
    ?? detuningFromText(product.download_name);
  const extension = product.storage_path.match(/\.([a-z0-9]+)$/i)?.[1]
    ?? product.download_name.match(/\.([a-z0-9]+)$/i)?.[1];
  const name = [
    title,
    bpm ? `${bpm}bpm` : "",
    track?.musical_key,
    detune === undefined ? "" : `detuned ${detune > 0 ? "+" : ""}${detune} cents`,
  ].filter(Boolean).join(" ").replace(/[<>:"/\\|?*%#&\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim();
  const downloadName = extension ? `${name || "Beat"} @yearofziova.${extension}` : product.download_name;
  const { data: signed, error: storageError } = await db.storage.from("purchased-beats")
    .createSignedUrl(product.storage_path, 60, { download: downloadName });
  if (storageError || !signed) return { error: "Couldn't prepare your download. Please try again." };
  return { url: signed.signedUrl };
}
