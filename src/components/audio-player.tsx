"use client";

import Image from "next/image";
import { PlaybackIcon } from "@/components/playback-icon";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject, type CSSProperties } from "react";
import { watchAudioProgress } from "@/lib/audio-progress";
import type { Beat } from "@/data/beats";

type Playback = { track: Beat | null; playing: boolean; play: (track: Beat) => void; playFile: (track: Beat, file: File) => void };
const PlaybackContext = createContext<Playback>({ track: null, playing: false, play: () => {}, playFile: () => {} });
function time(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function PlaybackProgress({ audio, length, shownLength, onSeek }: { audio: RefObject<HTMLAudioElement | null>; length: number; shownLength: number; onSeek: (seconds: number) => void }) {
  const seek = useRef<HTMLInputElement>(null);
  const elapsed = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    let previousText = "";
    return watchAudioProgress(player, seconds => {
      const position = Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, length || 0)) : 0;
      if (seek.current) {
        seek.current.value = String(position);
        seek.current.style.setProperty("--progress", `${length ? position / length * 100 : 0}%`);
      }
      const text = time(position);
      if (text !== previousText) {
        if (elapsed.current) elapsed.current.textContent = text;
        seek.current?.setAttribute("aria-valuetext", `${text} of ${time(shownLength)}`);
        previousText = text;
      }
    });
  }, [audio, length, shownLength]);
  return <>
    <span ref={elapsed} className="playbar-time">0:00</span>
    <input ref={seek} type="range" aria-label="Seek audio" aria-valuetext={`0:00 of ${time(shownLength)}`} min={0} max={length || 1} step="any" defaultValue={0} disabled={!length} onChange={event => {
      const next = Number(event.target.value);
      onSeek(next);
      event.currentTarget.style.setProperty("--progress", `${length ? next / length * 100 : 0}%`);
      if (elapsed.current) elapsed.current.textContent = time(next);
      event.currentTarget.setAttribute("aria-valuetext", `${time(next)} of ${time(shownLength)}`);
    }} />
    <span className="playbar-time">{time(shownLength)}</span>
  </>;
}
export function AudioPlayer({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef(0);
  const localSource = useRef<{ file: File; url: string } | null>(null);
  useEffect(() => () => { if (localSource.current) URL.revokeObjectURL(localSource.current.url); }, []);
  const [track, setTrack] = useState<Beat | null>(null);
  const [playing, setPlaying] = useState(false);
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
        setError("Couldn't play this track. Please try again.");
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
    releaseLocalSource();
    player.volume = volume;
    setTrack(next);
    setPlaying(false);
    setLength(0);
    void resume();
  }
  function releaseLocalSource() {
    if (localSource.current) URL.revokeObjectURL(localSource.current.url);
    localSource.current = null;
  }
  function playFile(next: Beat, file: File) {
    if (!audio.current) return;
    if (track?.id === next.id && localSource.current?.file === file) { toggle(); return; }
    const url = URL.createObjectURL(file);
    play({ ...next, audioUrl: url });
    localSource.current = { file, url };
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
    releaseLocalSource();
    setTrack(null);
    setPlaying(false);
    setLength(0);
    setError("");
  }
  const shownLength = length || track?.durationSeconds || 0;
  return <PlaybackContext.Provider value={{ track, playing, play, playFile }}>
    {children}
    <audio ref={audio} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onLoadedMetadata={event => { const duration = event.currentTarget.duration; setLength(Number.isFinite(duration) ? duration : 0); }}
      onDurationChange={event => { const duration = event.currentTarget.duration; setLength(Number.isFinite(duration) ? duration : 0); }}
      onError={() => { setPlaying(false); setError("This track is unavailable. Please try again later."); }} />
    {track && <section className="playbar" aria-label="Audio player">
      <div className="playbar-track">
        {track.coverArt ? <Image src={track.coverArt} alt="" width={44} height={44} className="playbar-cover" /> : <span className="playbar-cover playbar-cover-empty" aria-hidden="true">♫</span>}
        <div><p className="playbar-title">{track.title}</p><span>ziova</span></div>
      </div>
      <div className="playbar-transport">
        <button type="button" className="playbar-toggle" aria-label={`${playing ? "Pause" : "Play"} audio`} onClick={toggle}><PlaybackIcon playing={playing} size={18} /></button>
        <PlaybackProgress key={`${track.id}:${track.audioUrl}`} audio={audio} length={length} shownLength={shownLength} onSeek={seconds => { if (audio.current) audio.current.currentTime = seconds; }} />
      </div>
      <div className="playbar-volume">
        <button type="button" aria-label={volume ? "Mute audio" : "Unmute audio"} onClick={() => changeVolume(volume ? 0 : previousVolume.current)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" />{volume ? <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 5 6m0-6-5 6" />}</svg></button>
        <input type="range" aria-label="Volume" style={{ "--progress": `${volume * 100}%` } as CSSProperties} aria-valuetext={`${Math.round(volume * 100)} percent`} min={0} max={1} step={0.01} value={volume} onChange={event => changeVolume(Number(event.target.value))} />
      </div>
      <button type="button" className="playbar-close" aria-label="Close player" onClick={close}>×</button>
      {error && <p className="playbar-error" role="alert">{error}</p>}
    </section>}
  </PlaybackContext.Provider>;
}
export function usePlayback() { return useContext(PlaybackContext); }
