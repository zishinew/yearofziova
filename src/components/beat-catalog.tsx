"use client";

import { useRef, useState } from "react";
import { beats, loops, BEAT_PRICE_CAD, type Beat } from "@/data/beats";

const genres = ["All", "Trap", "R&B", "Experimental"] as const;
const contactUrl = "https://www.instagram.com/yearofziova/";

export function BeatCatalog({ kind = "beats" }: { kind?: "beats" | "loops" }) {
  const isBeats = kind === "beats";
  const tracks = isBeats ? beats : loops;
  const [genre, setGenre] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [activeBeat, setActiveBeat] = useState<Beat | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const filtered = tracks.filter((beat) =>
    (genre === "All" || beat.genre === genre) &&
    `${beat.title} ${beat.key} ${beat.bpm}`.toLowerCase().includes(query.toLowerCase()),
  );

  async function preview(beat: Beat) {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError("");
    if (activeBeat?.id === beat.id && !audio.paused) {
      audio.pause();
      return;
    }
    if (activeBeat?.id !== beat.id) {
      setActiveBeat(beat);
      audio.src = beat.audioUrl;
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setAudioError("This preview is unavailable. Please try again.");
    }
  }

  return (
    <section id={kind} className="catalog-section section-shell">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{isBeats ? "01 / BEATS" : "02 / LOOPS"}</span>
          <h2>{isBeats ? "Find your sound." : "Start with a loop."}</h2>
        </div>
        <p>{isBeats ? <>Every beat. $24.99 CAD.<br />Your next track starts here.</> : <>Loops by ziova.<br />A spark for your next idea.</>}</p>
      </div>

      <div className="catalog-toolbar">
        <div className="genre-filters" aria-label={`Filter ${kind} by genre`}>
          {genres.map((item) => (
            <button key={item} type="button" aria-pressed={genre === item}
              onClick={() => setGenre(item)} className={genre === item ? "genre-active" : ""}>
              {item}
            </button>
          ))}
        </div>
        <label className="catalog-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search {kind}</span>
          <input type="search" placeholder="Search a sound" value={query}
            onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      <div className="beat-table-heading eyebrow" aria-hidden="true">
        <span>{isBeats ? "TRACK" : "LOOP"}</span><span>BPM / KEY</span><span>{isBeats ? "PRICE / CAD" : "INQUIRIES"}</span>
      </div>
      {filtered.length ? (
        <div className="beat-list">
          {filtered.map((beat, index) => (
            <article className="beat-row" key={beat.id}>
              <div className="beat-identity">
                <button className="play-button" type="button" onClick={() => preview(beat)}
                  aria-label={`${activeBeat?.id === beat.id && playing ? "Pause" : "Preview"} ${beat.title}`}>
                  {activeBeat?.id === beat.id && playing ? "Ⅱ" : "▶"}
                </button>
                <div><h3>{beat.title}</h3><span className="eyebrow">{String(index + 1).padStart(2, "0")} / {beat.genre}</span></div>
              </div>
              <span className="beat-tempo">{beat.bpm} / {beat.key}</span>
              <a href={beat.purchaseUrl || contactUrl} target="_blank" rel="noreferrer" className="beat-price">
                {isBeats ? `$${BEAT_PRICE_CAD.toFixed(2)}` : "Inquire"} <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="catalog-empty">
          <div className="empty-wave" aria-hidden="true">
            {[12, 24, 40, 60, 32, 48, 72, 44, 28, 52, 36, 20, 12].map((height, index) =>
              <span key={index} style={{ height }} />,
            )}
          </div>
          <span className="eyebrow">{tracks.length ? "NO MATCHES" : "THE NEXT CHAPTER"}</span>
          <h3>{tracks.length ? "Try a different sound." : isBeats ? "First drop coming soon." : "First loops coming soon."}</h3>
          <p>{tracks.length ? "Change your search or choose another genre." : "A new collection is on its way. Be here for the first listen."}</p>
          {tracks.length ? (
            <button className="text-link" onClick={() => { setQuery(""); setGenre("All"); }}>Reset filters <span aria-hidden="true">↗</span></button>
          ) : (
            <a className="text-link" href={contactUrl} target="_blank" rel="noreferrer">Follow @yearofziova <span aria-hidden="true">↗</span></a>
          )}
        </div>
      )}
      <div className="catalog-footnote">
        <span>{isBeats ? "All beats · $24.99 CAD" : "Loop availability & pricing · DM for details"}</span>
        <a href={contactUrl} target="_blank" rel="noreferrer">DM @yearofziova <span aria-hidden="true">↗</span></a>
      </div>
      <audio ref={audioRef} onPlay={(event) => {
        document.querySelectorAll("audio").forEach((audio) => {
          if (audio !== event.currentTarget) audio.pause();
        });
        setPlaying(true);
      }} onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setAudioError("This preview is unavailable. Please try again."); }} />
      {audioError && <p role="alert" className="audio-error">{audioError}</p>}
      {activeBeat && <div className="now-playing" aria-live="polite"><span className="eyebrow">{playing ? "NOW PLAYING" : "PAUSED"}</span> {activeBeat.title}
        <button type="button" onClick={() => preview(activeBeat)} aria-label={playing ? "Pause preview" : "Resume preview"}>{playing ? "Ⅱ" : "▶"}</button>
      </div>}
    </section>
  );
}
