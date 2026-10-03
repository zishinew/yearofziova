"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { PageTransition } from "@/components/page-transition";
import { useSiteSession } from "@/components/site-session";
import { CartButton } from "@/components/shopping-cart";
import { SoundPlaylist } from "@/components/sound-playlist";
import { beats, loops, type Beat } from "@/data/beats";

export function SiteCanvas({ skipLoader = false, beatTracks = beats, loopTracks = loops, catalogError = false }: {
  skipLoader?: boolean; beatTracks?: Beat[]; loopTracks?: Beat[]; catalogError?: boolean;
}) {
  const { entered, canvasReady } = useSiteSession();
  const [view, setView] = useState<"home" | "beats" | "loops">("home");
  const [phase, setPhase] = useState<"entering" | "center" | "docking" | "settled">(skipLoader || entered ? "settled" : "entering");
  const loading = phase !== "settled";
  const navigate = (next: typeof view) => startTransition(() => setView(next));

  useEffect(() => {
    if (!canvasReady || phase !== "center") return;
    const timer = window.setTimeout(() => setPhase("docking"), 250);
    return () => window.clearTimeout(timer);
  }, [canvasReady, phase]);

  return (
    <div id="top">
      <PageTransition view={view}>
        <main
          aria-busy={loading}
          inert={loading}
          className={view === "home" ? "vault-landing" : "vault-content"}
        >
          {view === "home" ? (
            <div className="vault-choices">
              <button type="button" onClick={() => navigate("beats")}>Beat Vault</button>
              <button type="button" onClick={() => navigate("loops")}>Loop Kit</button>
            </div>
          ) : <SoundPlaylist key={view} kind={view} tracks={view === "beats" ? beatTracks : loopTracks} loadError={catalogError} />}
        </main>
      </PageTransition>
      {loading && (
        <div
          role="status"
          aria-label="Loading page"
          className={`loader-screen ${phase === "docking" ? "loader-screen-leaving" : ""}`}
        >
          <span className="sr-only">Loading page</span>
        </div>
      )}
      <header className={`vault-header ${loading ? "vault-header-loading" : ""}`} aria-label="Site header">
        {!loading && <div className="header-actions"><CartButton /><Link href="/login" scroll={false}>Account</Link></div>}
        {view !== "home" && !loading && (
          <button type="button" className="vault-back" onClick={() => navigate("home")}>
            <span aria-hidden="true">←</span> Back
          </button>
        )}
        <button
          type="button"
          aria-label="Ziova home"
          aria-disabled={loading}
          onClick={() => { if (!loading) navigate("home"); }}
          className={`ziova-logo ziova-logo-${phase}`}
          onAnimationEnd={() => {
            if (phase === "entering") setPhase("center");
          }}
          onTransitionEnd={(event) => {
            if (event.propertyName === "transform" && phase === "docking") {
              setPhase("settled");
            }
          }}
        >
          <Image
            src="/eye transparent.png"
            alt=""
            width={192}
            height={192}
            preload
            className="h-full w-full object-contain"
          />
        </button>
      </header>
    </div>
  );
}
