"use server";

import { getAdminSession } from "@/lib/supabase/admin";

type File = { id: string; label: string; bucket: string; path: string; name: string };
async function adminFiles(trackId: string) {
  const session = await getAdminSession();
  if (!session) return { error: "Admin access required. Please sign in again." };
  if (typeof trackId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId)) return { error: "This track is unavailable." };
  const db = session.supabase;
  const { data: track, error } = await db.from("catalog_tracks").select("id,title,kind,preview_path,cover_path").eq("id",trackId).is("deleted_at",null).maybeSingle();
  if (error || !track) return { error: "This track is unavailable." };
  const { data: products, error: productError } = await db.from("download_products").select("id,lease,storage_path,download_name").or(`catalog_track_id.eq.${trackId},id.eq.${trackId}`);
  if (productError) return { error: "Couldn't load the files. Please try again." };
  const files: File[] = [];
  for (const product of products || []) {
    if (!product.storage_path?.startsWith(`${trackId}/`)) continue;
    files.push({ id: product.id, label: product.lease ? `Download ${product.lease.toUpperCase()}` : "Download original", bucket: "purchased-beats", path: product.storage_path, name: product.download_name });
  }
  const title = track.title.replace(/[^\w. ()-]/g,"_");
  if (track.preview_path?.startsWith(`${trackId}/`) && !products?.some(p => p.lease === "mp3")) {
    const extension = track.preview_path.split(".").pop() || "mp3";
    files.push({ id: "audio", label: "Download audio", bucket: "track-previews", path: track.preview_path, name: `${title}.${extension}` });
  }
  if (track.cover_path?.startsWith(`${trackId}/`)) {
    const extension = track.cover_path.split(".").pop() || "jpg";
    files.push({ id: "cover", label: "Download cover art", bucket: "track-covers", path: track.cover_path, name: `${title}-cover.${extension}` });
  }
  return { db, files };
}

export async function getAdminDownloadFiles(trackId: string): Promise<{ files?: { id: string; label: string }[]; error?: string }> {
  const result = await adminFiles(trackId);
  if (result.error || !result.files) return { error: result.error };
  return { files: result.files.map(({ id, label }) => ({ id, label })) };
}

export async function downloadAdminTrack(trackId: string, fileId: string): Promise<{ url?: string; error?: string }> {
  const result = await adminFiles(trackId);
  if (result.error || !result.files || !result.db) return { error: result.error };
  const file = result.files.find(file => file.id === fileId);
  if (!file) return { error: "This file is unavailable." };
  const { data, error } = await result.db.storage.from(file.bucket).createSignedUrl(file.path,60,{ download: file.name });
  if (error || !data) return { error: "Couldn't prepare your download. Please try again." };
  return { url: data.signedUrl };
}
