import { audioTypes, coverTypes, parseTrackText, type AdminTrack } from "@/lib/track-upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { saveTrack } from "@/app/admin/actions";

export type BulkTrack = { id: string; file: File; preview: File | null; cover: File | null; title: string; bpm: string };
export function bulkTrackError(track: BulkTrack, kind: "beats" | "loops") {
  if (!track.title.trim() || track.title.length > 120) return "Enter a title up to 120 characters.";
  const bpm = Number(track.bpm);
  if (!Number.isInteger(bpm) || bpm < 1 || bpm > 400) return "Enter a BPM from 1 to 400.";
  if (kind === "beats" && !/\.wav$/i.test(track.file.name)) return "Beats need a WAV file.";
  if (kind === "loops" && !track.preview) return "Choose preview audio for this ZIP.";
  for (const file of [track.file, track.preview]) if (file && (!file.size || file.size > 50 * 1024 * 1024)) return "Audio and ZIP files must be 50 MB or smaller.";
  if (track.cover && (!track.cover.size || track.cover.size > 5 * 1024 * 1024)) return "Cover art must be 5 MB or smaller.";
  return null;
}

async function duration(file: File) {
  const context = new OfflineAudioContext(2, 1, 44100);
  const audio = await context.decodeAudioData(await file.arrayBuffer());
  return Math.max(1, Math.round(audio.duration));
}

export async function uploadBulkTrack(track: BulkTrack, kind: "beats" | "loops", published: boolean, tags: string[], notes: string[], onProgress: (message: string) => void) {
  const invalid = bulkTrackError(track, kind);
  if (invalid) throw new Error(invalid);
  const client = createBrowserSupabaseClient();
  const uploaded: { bucket: string; path: string }[] = [];
  async function upload(file: File, bucket: string, types: Record<string, string>) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!types[extension]) throw new Error(`Unsupported file: ${file.name}`);
    onProgress(`Uploading ${file.name}…`);
    const path = `${track.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from(bucket).upload(path, file, { contentType: types[extension], upsert: false });
    if (error) throw new Error(`Couldn't upload ${file.name}. ${error.message}`);
    uploaded.push({ bucket, path });
    return path;
  }
  try {
    let preview = track.preview;
    let mp3: File | null = null;
    let seconds: number;
    if (kind === "beats") {
      const { wavToMp3 } = await import("@/lib/wav-to-mp3");
      const generated = await wavToMp3(track.file, onProgress);
      preview = generated.mp3; mp3 = generated.mp3; seconds = generated.duration;
    } else {
      onProgress("Reading preview…");
      seconds = await duration(preview!);
    }
    const previewPath = await upload(preview!, "track-previews", audioTypes);
    const coverPath = kind === "beats" && track.cover ? await upload(track.cover, "track-covers", coverTypes) : null;
    const downloadPath = await upload(track.file, "purchased-beats", { ...audioTypes, zip: "application/zip" });
    const name = (file: File) => file.name.replace(/[^\w. ()-]/g, "_").slice(0, 200);
    const leases: { lease: "mp3" | "wav"; path: string; name: string }[] = [];
    if (mp3) {
      const path = await upload(mp3, "purchased-beats", audioTypes);
      leases.push({ lease: "mp3", path, name: name(mp3) }, { lease: "wav", path: downloadPath, name: name(track.file) });
    }
    const parsed = parseTrackText(track.title);
    const payload: AdminTrack = { id: track.id, kind, title: parsed.title || "Untitled", bpm: Number(track.bpm), duration_seconds: seconds, genre: "", musical_key: "", description: "", moods: [], tags, notes: [...new Set([...notes, ...parsed.notes])], preview_path: previewPath, cover_path: coverPath, published };
    onProgress("Saving track…");
    const result = await saveTrack(payload, kind === "loops" ? downloadPath : undefined, kind === "loops" ? name(track.file) : undefined, leases);
    if (result.error) throw new Error(result.error);
  } catch (error) {
    // Existing RLS prevents deleting files that were successfully saved.
    await Promise.allSettled(uploaded.map(file => client.storage.from(file.bucket).remove([file.path])));
    throw error;
  }
}
