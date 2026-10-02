"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/supabase/admin";
import { UUID, type AdminTrack } from "@/lib/track-upload";

function validText(value: unknown, max: number) { return typeof value === "string" && value.length <= max; }
function validList(value: unknown, max: number) {
  return Array.isArray(value) && value.length <= 30 && value.every(v => validText(v, max));
}

export async function saveTrack(track: AdminTrack, downloadPath?: string, downloadName?: string): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session) return { error: "Admin access required. Please sign in again." };
  if (!track || !UUID.test(track.id) || !["beats", "loops"].includes(track.kind)
    || !validText(track.title, 120) || !track.title.trim()
    || !Number.isInteger(track.bpm) || track.bpm < 1 || track.bpm > 400
    || (track.duration_seconds !== null && (!Number.isInteger(track.duration_seconds) || track.duration_seconds < 1 || track.duration_seconds > 86400))
    || !validText(track.genre, 120) || !validText(track.musical_key, 40) || !validText(track.description, 2000)
    || !validList(track.moods, 80) || !validList(track.tags, 80) || !validList(track.notes, 500)
    || typeof track.published !== "boolean") return { error: "Check your track details and try again." };
  const files = [
    { bucket: "track-previews", path: track.preview_path, limit: 50 * 1024 * 1024 },
    { bucket: "track-covers", path: track.cover_path, limit: 5 * 1024 * 1024 },
    { bucket: "purchased-beats", path: downloadPath, limit: 50 * 1024 * 1024 },
  ];
  for (const file of files) {
    if (!file.path && file.bucket !== "track-previews") continue;
    if (typeof file.path !== "string" || !file.path.startsWith(`${track.id}/`) || !/^[\da-f-]{36}\/[\da-f-]{36}\.(mp3|wav|ogg|m4a|flac|jpg|jpeg|png|webp|zip)$/i.test(file.path)) {
      return { error: "Invalid uploaded file. Please choose the file again." };
    }
    const { data, error } = await session.supabase.storage.from(file.bucket).info(file.path);
    if (error || !data || typeof data.size !== "number" || data.size <= 0 || data.size > file.limit) return { error: "An uploaded file is missing or too large. Please upload it again." };
  }
  if (downloadPath && (!validText(downloadName, 200) || !downloadName || /[\/\\\r\n]/.test(downloadName))) return { error: "Invalid download filename." };
  const { error } = await session.supabase.rpc("save_catalog_track", {
    p_track: { ...track, title: track.title.trim() }, p_download_path: downloadPath || null, p_download_name: downloadName || null,
  });
  if (error) return { error: "Couldn't save this track. Please try again." };
  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}

export async function setTrackPublished(id: string, published: boolean): Promise<{ error?: string }> {
  const session = await getAdminSession();
  if (!session || !UUID.test(id) || typeof published !== "boolean") return { error: "Admin access required." };
  const { data, error } = await session.supabase.from("catalog_tracks").update({ published, updated_at: new Date().toISOString() }).eq("id", id).select("id").single();
  if (error || !data) return { error: "Couldn't update this track." };
  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}
