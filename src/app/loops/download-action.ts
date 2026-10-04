"use server";

import { createClient } from "@supabase/supabase-js";

export async function downloadLoop(trackId: string, accepted: boolean): Promise<{ url?: string; error?: string }> {
  if (accepted !== true) return { error: "Please agree to the terms of use before downloading." };
  if (typeof trackId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId)) return { error: "This loop is unavailable." };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { error: "Downloads are unavailable right now." };
  try {
    // The secret stays on the server. Only published loops can receive a URL;
    // callers cannot supply a storage path or use this action to download beats.
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: track, error } = await db.from("catalog_tracks").select("id,title,preview_path")
      .eq("id", trackId).eq("kind", "loops").eq("published", true).is("deleted_at", null).maybeSingle();
    if (error || !track) return { error: "This loop is unavailable." };
    const { data: product, error: productError } = await db.from("download_products").select("storage_path,download_name").eq("id", track.id).maybeSingle();
    if (productError) return { error: "Couldn't prepare your download. Please try again." };
    const path = product?.storage_path || track.preview_path;
    if (!path || !path.startsWith(`${track.id}/`)) return { error: "This loop is unavailable." };
    const extension = path.split(".").pop() || "wav";
    const name = product?.download_name || `${track.title.replace(/[^\w. ()-]/g, "_")}.${extension}`;
    const { data: signed, error: storageError } = await db.storage.from(product ? "purchased-beats" : "track-previews")
      .createSignedUrl(path, 60, { download: name });
    if (storageError || !signed) return { error: "Couldn't prepare your download. Please try again." };
    return { url: signed.signedUrl };
  } catch {
    return { error: "Couldn't prepare your download. Please try again." };
  }
}
