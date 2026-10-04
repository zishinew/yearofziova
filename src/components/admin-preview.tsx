"use client";

import { usePlayback } from "@/components/audio-player";
import { PlaybackIcon } from "@/components/playback-icon";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AdminPreview({ id, title, bpm, file, previewPath, coverPath }: { id: string; title: string; bpm: number; file?: File | null; previewPath?: string; coverPath?: string | null }) {
  const playback = usePlayback();
  const playing = playback.track?.id === id && playback.playing;
  return <button type="button" className="admin-preview" disabled={!file && !previewPath} aria-label={`${playing ? "Pause" : "Play"} ${title || "untitled track"}`} aria-pressed={playing} onClick={() => {
    const track = { id, title: title || file?.name || "Untitled", bpm };
    if (file) { playback.playFile(track, file); return; }
    if (!previewPath) return;
    const client = createBrowserSupabaseClient();
    playback.play({ ...track, audioUrl: client.storage.from("track-previews").getPublicUrl(previewPath).data.publicUrl, coverArt: coverPath ? client.storage.from("track-covers").getPublicUrl(coverPath).data.publicUrl : undefined });
  }}><PlaybackIcon playing={playing} size={14} /><span>{playing ? "Pause" : "Play"}</span></button>;
}
