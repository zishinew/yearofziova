"use client";

import Image from "next/image";
import { useState } from "react";
import { BEAT_PRICE_CAD, type Beat } from "@/data/beats";

function duration(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function SoundPlaylist({ kind, tracks, loadError = false }: { kind: "beats" | "loops"; tracks: Beat[]; loadError?: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const title = kind === "beats" ? "Beat Vault" : "Loop Kit";

  return (
    <section className="sound-playlist" aria-label={title}>
      <h1>{title}</h1>
      <div className="playlist-columns" aria-hidden="true">
        <span>Title</span><span>BPM</span><span>Time</span>
      </div>
      <div className="playlist-tracks">
        {tracks.map((track) => (
          <details
            key={track.id}
            className="playlist-track"
            open={hovered === track.id || expanded === track.id}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setHovered(track.id);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setHovered(null);
            }}
          >
            <summary
              className="playlist-summary"
              onClick={(event) => {
                event.preventDefault();
                setExpanded(expanded === track.id ? null : track.id);
              }}
            >
              <span className="playlist-identity">
                {track.coverArt ? (
                  <Image src={track.coverArt} alt="" width={48} height={48} className="playlist-cover" />
                ) : <span className="playlist-cover playlist-cover-empty" aria-hidden="true">♫</span>}
                <span className="playlist-title">{track.title}</span>
              </span>
              <span className="playlist-number"><span className="sr-only">BPM: </span>{track.bpm}</span>
              <span className="playlist-number"><span className="sr-only">Duration: </span>{duration(track.durationSeconds)}</span>
            </summary>
            <div className="playlist-details">
              {track.description && <p className="track-description">{track.description}</p>}
              {track.moods?.length ? <div className="track-meta"><span>Moods</span><p>{track.moods.join(" · ")}</p></div> : null}
              {track.tags?.length ? <div className="track-meta"><span>Tags</span><div className="track-tags">{track.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div> : null}
              {(track.key || track.genre) && <div className="track-meta"><span>Sound</span><p>{[track.genre, track.key].filter(Boolean).join(" · ")}</p></div>}
              {track.notes?.length ? <div className="track-meta"><span>Notes</span><div>{track.notes.map((note, index) => <p key={index}>{note}</p>)}</div></div> : null}
              {track.audioUrl && (
                <audio controls preload="none" src={track.audioUrl} aria-label={`Preview ${track.title}`}
                  onPlay={(event) => {
                    document.querySelectorAll("audio").forEach((audio) => {
                      if (audio !== event.currentTarget) audio.pause();
                    });
                  }} />
              )}
              <a className="track-inquiry" href={track.purchaseUrl || "https://www.instagram.com/yearofziova/"} target="_blank" rel="noreferrer">
                {kind === "beats" ? `$${BEAT_PRICE_CAD.toFixed(2)} CAD · Inquire` : "Inquire about this loop"} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </details>
        ))}
        {loadError && <p className="playlist-empty" role="status">Couldn’t load the catalog. Please refresh and try again.</p>}
        {!loadError && tracks.length === 0 && <p className="playlist-empty">{kind === "beats" ? "Beats" : "Loops"} coming soon.</p>}
      </div>
    </section>
  );
}
