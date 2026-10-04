"use client";

import Image from "next/image";
import { PlaybackIcon } from "@/components/playback-icon";
import { usePlayback } from "@/components/audio-player";
import { type Beat } from "@/data/beats";
import { useCart } from "@/components/shopping-cart";
import { LoopDownload } from "@/components/loop-download";

function duration(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function TrackRow({ track, kind }: { track: Beat; kind: "beats" | "loops" }) {
  const playback = usePlayback();
  const playing = playback.track?.id === track.id && playback.playing;
  const cart = useCart();
  const owned = cart.owns(track.id);
  const added = cart.items.some(item => item.id === track.id);
  const label = owned ? "Upgrade lease" : added ? "Change lease" : "Add to cart";
  return <article className={`playlist-track playlist-compact-row ${playing ? "playlist-track-playing" : ""}`}>
    <button type="button" className="playlist-summary" onClick={() => playback.play(track)} disabled={!track.audioUrl} aria-label={`${playing ? "Pause" : "Play"} ${track.title}`} aria-pressed={playing}>
      <span className="playlist-identity">
        <span className="playlist-art">{track.coverArt ? <Image src={track.coverArt} alt="" width={48} height={48} className="playlist-cover" /> : <span className="playlist-cover playlist-cover-empty" aria-hidden="true">♫</span>}<span className="playlist-play-icon" aria-hidden="true"><PlaybackIcon playing={playing} /></span></span>
        <span className="playlist-name"><span className="playlist-title">{track.title}</span>{track.notes?.length ? <span className="playlist-inline-notes" title={track.notes.join(" · ")}>{track.notes.join(" · ")}</span> : null}</span>
      </span>
      <span className="track-tags playlist-inline-tags" aria-label="Tags" title={track.tags?.join(" · ")}>{track.tags?.map((tag, i) => <span key={`${tag}-${i}`}>{tag}</span>)}</span>
      <span className="playlist-number"><span className="sr-only">BPM: </span>{track.bpm}</span>
      <span className="playlist-number"><span className="sr-only">Duration: </span>{duration(track.durationSeconds)}</span>
    </button>
    {kind === "beats" ? <button type="button" className="track-add" aria-label={`${label} for ${track.title}`} onClick={() => cart.add(track)}>{label}</button> : <LoopDownload id={track.id} title={track.title} />}
  </article>;
}
export function SoundPlaylist({ kind, tracks, loadError = false }: { kind: "beats" | "loops"; tracks: Beat[]; loadError?: boolean }) {
  const title = kind === "beats" ? "Beat Vault" : "Loop Kit";
  return <section className="sound-playlist" aria-label={title}><h1>{title}</h1>
    <div className="playlist-table"><div className="playlist-columns" aria-hidden="true"><span>Title</span><span>Tags</span><span>BPM</span><span>Time</span><span /></div>
    <div className="playlist-tracks">{tracks.map(track => <TrackRow key={track.id} track={track} kind={kind} />)}
      {loadError && <p className="playlist-empty" role="status">Couldn’t load the catalog. Please refresh and try again.</p>}
      {!loadError && tracks.length === 0 && <p className="playlist-empty">{kind === "beats" ? "Beats" : "Loops"} coming soon.</p>}
    </div></div></section>;
}
