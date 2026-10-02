import "server-only";
import { createClient } from "@supabase/supabase-js";
import { beats, loops, type Beat } from "@/data/beats";

export async function getCatalog(): Promise<{ beats: Beat[]; loops: Beat[]; error?: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { beats, loops };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("catalog_tracks")
    .select("id,kind,title,bpm,duration_seconds,genre,musical_key,description,moods,tags,notes,preview_path,cover_path")
    .eq("published", true).order("created_at", { ascending: false });
  if (error) return { beats, loops, error: true };
  const tracks = (data || []).map((track) => ({
    kind: track.kind,
    id: track.id, title: track.title, bpm: track.bpm,
    durationSeconds: track.duration_seconds ?? undefined,
    genre: track.genre, key: track.musical_key, description: track.description,
    moods: track.moods, tags: track.tags, notes: track.notes,
    audioUrl: client.storage.from("track-previews").getPublicUrl(track.preview_path).data.publicUrl,
    coverArt: track.cover_path ? client.storage.from("track-covers").getPublicUrl(track.cover_path).data.publicUrl : undefined,
  }));
  return { beats: [...beats, ...tracks.filter(t => t.kind === "beats")], loops: [...loops, ...tracks.filter(t => t.kind === "loops")] };
}
