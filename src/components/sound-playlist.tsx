"use client";

import Image from "next/image";
import { usePlayback } from "@/components/audio-player";
import { BEAT_PRICE_CAD, type Beat } from "@/data/beats";
import { useCart } from "@/components/shopping-cart";

function duration(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function TrackRow({ track, kind }: { track: Beat; kind: "beats" | "loops" }) {
  const playback = usePlayback();
  const playing = playback.track?.id === track.id && playback.playing;
  const cart = useCart();
  const added = cart.items.some(item => item.id === track.id);
  return <article className={`playlist-track ${playing ? "playlist-track-playing" : ""}`}>
    <button type="button" className="playlist-summary" onClick={() => playback.play(track)} disabled={!track.audioUrl} aria-label={`${playing ? "Pause" : "Play"} ${track.title}`} aria-pressed={playing}>
      <span className="playlist-identity">
        <span className="playlist-art">{track.coverArt ? <Image src={track.coverArt} alt="" width={48} height={48} className="playlist-cover" /> : <span className="playlist-cover playlist-cover-empty" aria-hidden="true">♫</span>}<span className="playlist-play-icon" aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span></span>
        <span className="playlist-title">{track.title}</span>
      </span>
      <span className="playlist-number"><span className="sr-only">BPM: </span>{track.bpm}</span>
      <span className="playlist-number"><span className="sr-only">Duration: </span>{duration(track.durationSeconds)}</span>
    </button>
    <div className="playlist-details">
      {track.tags?.length ? <div className="track-tags" aria-label="Tags">{track.tags.map((tag, i) => <span key={`${tag}-${i}`}>{tag}</span>)}</div> : null}
      {track.notes?.length ? <div className="track-notes"><span>Additional notes</span>{track.notes.map((note, index) => <p key={index}>{note}</p>)}</div> : null}
      <div className="track-actions">{kind === "beats" ? <><span>${BEAT_PRICE_CAD.toFixed(2)} CAD</span><button type="button" className="track-add" onClick={() => cart.add(track)} disabled={added}>{added ? "Added to cart" : "Add to cart"}</button></> : <a href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer">Inquire about this loop ↗</a>}</div>
    </div>
  </article>;
}
export function SoundPlaylist({ kind, tracks, loadError = false }: { kind: "beats" | "loops"; tracks: Beat[]; loadError?: boolean }) {
  const title = kind === "beats" ? "Beat Vault" : "Loop Kit";
  return <section className="sound-playlist" aria-label={title}><h1>{title}</h1>
    <div className="playlist-columns" aria-hidden="true"><span>Title</span><span>BPM</span><span>Time</span></div>
    <div className="playlist-tracks">{tracks.map(track => <TrackRow key={track.id} track={track} kind={kind} />)}
      {loadError && <p className="playlist-empty" role="status">Couldn’t load the catalog. Please refresh and try again.</p>}
      {!loadError && tracks.length === 0 && <p className="playlist-empty">{kind === "beats" ? "Beats" : "Loops"} coming soon.</p>}
    </div></section>;
}
