"use client";

import Image from "next/image";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { Beat } from "@/data/beats";

type Playback = { track: Beat | null; playing: boolean; play: (track: Beat) => void };
const PlaybackContext = createContext<Playback>({ track: null, playing: false, play: () => {} });
function time(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function AudioPlayer({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef(0);
  const [track, setTrack] = useState<Beat | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [length, setLength] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const previousVolume = useRef(0.8);
  const [error, setError] = useState("");

  async function resume() {
    const player = audio.current;
    if (!player) return;
    const ticket = ++request.current;
    setError("");
    try { await player.play(); }
    catch (problem) {
      if (ticket === request.current && !(problem instanceof DOMException && problem.name === "AbortError")) {
        setPlaying(false);
        setError("Couldn't play this preview. Please try again.");
      }
    }
  }
  function toggle() {
    if (!audio.current) return;
    if (!audio.current.paused) { request.current++; audio.current.pause(); }
    else void resume();
  }
  function play(next: Beat) {
    const player = audio.current;
    if (!player || !next.audioUrl) return;
    if (track?.id === next.id && track.audioUrl === next.audioUrl) { toggle(); return; }
    request.current++;
    player.pause();
    player.src = next.audioUrl;
    player.volume = volume;
    setTrack(next);
    setPlaying(false);
    setPosition(0);
    setLength(0);
    void resume();
  }
  function changeVolume(next: number) {
    setVolume(next);
    if (audio.current) audio.current.volume = next;
    if (next > 0) previousVolume.current = next;
  }
  function close() {
    request.current++;
    const player = audio.current;
    player?.pause();
    player?.removeAttribute("src");
    player?.load();
    setTrack(null);
    setPlaying(false);
    setPosition(0);
    setLength(0);
    setError("");
  }
  const shownLength = length || track?.durationSeconds || 0;
  return <PlaybackContext.Provider value={{ track, playing, play }}>
    {children}
    <audio ref={audio} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onLoadedMetadata={event => { const duration = event.currentTarget.duration; setLength(Number.isFinite(duration) ? duration : 0); }}
      onDurationChange={event => { const duration = event.currentTarget.duration; setLength(Number.isFinite(duration) ? duration : 0); }}
      onError={() => { setPlaying(false); setError("This preview is unavailable. Please try again later."); }} />
    {track && <section className="playbar" aria-label="Audio player">
      <div className="playbar-track">
        {track.coverArt ? <Image src={track.coverArt} alt="" width={44} height={44} className="playbar-cover" /> : <span className="playbar-cover playbar-cover-empty" aria-hidden="true">♫</span>}
        <div><p className="playbar-title">{track.title}</p><span>ziova</span></div>
      </div>
      <div className="playbar-transport">
        <button type="button" className="playbar-toggle" aria-label={`${playing ? "Pause" : "Play"} preview`} onClick={toggle}><span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span></button>
        <span className="playbar-time">{time(position)}</span>
        <input type="range" aria-label="Seek preview" aria-valuetext={`${time(position)} of ${time(shownLength)}`} min={0} max={length || 1} step={0.1} value={Math.min(position, length || 1)} disabled={!length} onChange={event => {
          const next = Number(event.target.value);
          if (audio.current) { audio.current.currentTime = next; setPosition(next); }
        }} />
        <span className="playbar-time">{time(shownLength)}</span>
      </div>
      <div className="playbar-volume">
        <button type="button" aria-label={volume ? "Mute preview" : "Unmute preview"} onClick={() => changeVolume(volume ? 0 : previousVolume.current)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" />{volume ? <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 5 6m0-6-5 6" />}</svg></button>
        <input type="range" aria-label="Volume" aria-valuetext={`${Math.round(volume * 100)} percent`} min={0} max={1} step={0.01} value={volume} onChange={event => changeVolume(Number(event.target.value))} />
      </div>
      <button type="button" className="playbar-close" aria-label="Close player" onClick={close}>×</button>
      {error && <p className="playbar-error" role="alert">{error}</p>}
    </section>}
  </PlaybackContext.Provider>;
}
export function usePlayback() { return useContext(PlaybackContext); }
